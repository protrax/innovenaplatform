import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { clientEnv } from "@/lib/env";

export const runtime = "nodejs";

// Public endpoint that innovena.no (and other front-ends) call when a
// customer submits a project inquiry. Does three things:
//   1. Creates (or finds) a customer user + profile
//   2. Creates a project with category links + triggers lead distribution
//   3. Sends a magic-link login so the customer can see their project
//
// No auth required. Rate limiting should be added before enabling CORS widely.
const Body = z.object({
  customer: z.object({
    email: z.string().email(),
    full_name: z.string().min(1).max(120).optional(),
    phone: z.string().max(40).optional(),
  }),
  project: z.object({
    title: z.string().min(3).max(200),
    description: z.string().min(10),
    budget_min_nok: z.number().int().min(0).nullable().optional(),
    budget_max_nok: z.number().int().min(0).nullable().optional(),
    category_slugs: z.array(z.string()).default([]),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    location: z.string().max(120).optional(),
    remote_ok: z.boolean().optional(),
  }),
  source: z.string().max(80).default("innovena_site"),
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders() },
    );
  }

  const { customer, project, source } = parsed.data;
  const admin = createAdminClient();

  // 1. Find or create customer user
  const { data: existing } = await admin.auth.admin.listUsers();
  let userId: string | undefined = existing.users.find(
    (u) => u.email === customer.email,
  )?.id;

  if (!userId) {
    const { data: newUser, error: createError } =
      await admin.auth.admin.createUser({
        email: customer.email,
        email_confirm: true, // auto-confirm — they'll log in via magic link
        user_metadata: {
          full_name: customer.full_name ?? customer.email.split("@")[0],
        },
      });
    if (createError || !newUser.user) {
      return NextResponse.json(
        { error: createError?.message ?? "Kunne ikke opprette bruker" },
        { status: 500, headers: corsHeaders() },
      );
    }
    userId = newUser.user.id;

    // Profile row should be created by trigger; update fields we have
    await admin
      .from("profiles")
      .update({
        full_name: customer.full_name ?? null,
        phone: customer.phone ?? null,
      })
      .eq("id", userId);
  } else {
    // Patch missing fields on existing profile
    const patch: Record<string, string> = {};
    if (customer.full_name) patch.full_name = customer.full_name;
    if (customer.phone) patch.phone = customer.phone;
    if (Object.keys(patch).length > 0) {
      await admin.from("profiles").update(patch).eq("id", userId);
    }
  }

  // Make sure they have the 'customer' role
  await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "customer" });

  // 2. Create the project
  const { data: createdProject, error: projectError } = await admin
    .from("projects")
    .insert({
      customer_id: userId,
      title: project.title,
      description: project.description,
      budget_min_nok: project.budget_min_nok ?? null,
      budget_max_nok: project.budget_max_nok ?? null,
      deadline: project.deadline ?? null,
      location: project.location ?? null,
      remote_ok: project.remote_ok ?? true,
      status: "open",
      source,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (projectError || !createdProject) {
    return NextResponse.json(
      { error: projectError?.message ?? "Kunne ikke opprette prosjekt" },
      { status: 500, headers: corsHeaders() },
    );
  }

  // Link categories by slug
  let categoryIds: string[] = [];
  if (project.category_slugs.length > 0) {
    const { data: categories } = await admin
      .from("service_categories")
      .select("id")
      .in("slug", project.category_slugs);
    categoryIds = (categories ?? []).map((c) => c.id);
    if (categoryIds.length > 0) {
      await admin
        .from("project_categories")
        .insert(
          categoryIds.map((category_id) => ({
            project_id: createdProject.id,
            category_id,
          })),
        );
    }
  }

  // 3. Distribute leads (same logic as authenticated /api/projects)
  if (categoryIds.length > 0) {
    const { data: matchingTenants } = await admin
      .from("tenant_categories")
      .select("tenant_id, tenants!inner(status)")
      .in("category_id", categoryIds);
    // @ts-expect-error — joined
    const active = (matchingTenants ?? []).filter((r) => r.tenants?.status === "active");
    const tenantIds = Array.from(new Set(active.map((r) => r.tenant_id))).slice(0, 5);
    if (tenantIds.length > 0) {
      await admin.from("project_leads").insert(
        tenantIds.map((tenant_id) => ({
          project_id: createdProject.id,
          tenant_id,
        })),
      );
      for (const tenant_id of tenantIds) {
        const { data: firstStage } = await admin
          .from("pipeline_stages")
          .select("id")
          .eq("tenant_id", tenant_id)
          .order("sort_order")
          .limit(1)
          .maybeSingle();
        if (firstStage) {
          await admin.from("pipeline_cards").insert({
            tenant_id,
            project_id: createdProject.id,
            stage_id: firstStage.id,
          });
        }
      }
      for (const tenant_id of tenantIds) {
        void sendEmail({
          type: "new_lead",
          to_tenant_id: tenant_id,
          project_title: project.title,
          project_description: project.description,
          budget_min_nok: project.budget_min_nok ?? null,
          budget_max_nok: project.budget_max_nok ?? null,
          project_id: createdProject.id,
        });
      }
    }
  }

  // 4. Generate magic link and send it via Resend (NOT Supabase auto-send —
  // admin.generateLink only RETURNS the link, it doesn't send.)
  // Route through /api/auth/callback so session cookies are set server-side.
  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const nextPath = `/kunde/prosjekter/${createdProject.id}`;
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: customer.email,
      options: {
        redirectTo: `${appUrl}/api/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

  if (linkError) {
    console.error("[inquiries] generateLink failed:", linkError);
  } else if (linkData?.properties?.action_link) {
    void sendEmail({
      type: "magic_link",
      to_email: customer.email,
      project_title: project.title,
      action_link: linkData.properties.action_link,
    });
  }

  // Project-received confirmation (in addition to the magic-link login).
  void sendEmail({
    type: "project_received",
    to_user_id: userId,
    project_title: project.title,
    project_id: createdProject.id,
  });

  return NextResponse.json(
    {
      ok: true,
      project_id: createdProject.id,
      customer_login_url: `${appUrl}/logg-inn`,
      message:
        "Forespørselen er registrert. Kunden har fått en e-post med innloggingslenke.",
    },
    { headers: corsHeaders() },
  );
}
