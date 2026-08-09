import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail } from "@/lib/email/send";
import {
  prioritizeTenants,
  maxRecipientsForCategories,
} from "@/lib/lead-distribution";

const Body = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  budget_min_nok: z.number().int().min(0).nullable().optional(),
  budget_max_nok: z.number().int().min(0).nullable().optional(),
  category_ids: z.array(z.string().uuid()).default([]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { title, description, budget_min_nok, budget_max_nok, category_ids } =
    parsed.data;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      customer_id: user.id,
      title,
      description,
      budget_min_nok,
      budget_max_nok,
      status: "open",
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !project) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke opprette prosjekt" },
      { status: 500 },
    );
  }

  if (category_ids.length > 0) {
    await supabase
      .from("project_categories")
      .insert(
        category_ids.map((category_id) => ({
          project_id: project.id,
          category_id,
        })),
      );
  }

  // Fordelingen kjører etter at svaret er sendt, men MÅ få lov til å fullføre.
  // Uten waitUntil kan Vercel suspendere instansen når ruta returnerer, og da
  // opprettes prosjektet uten at noe byrå får det — forespørselen blir liggende
  // som «Ikke distribuert» uten spor av hvorfor. Samme felle som e-postene.
  waitUntil(
    distributeLeadsInBackground(project.id, category_ids).catch((err) => {
      console.error("lead distribution failed", err);
    }),
  );

  // Confirmation email to the customer that their brief is out there.
  queueEmail({
    type: "project_received",
    to_user_id: user.id,
    project_title: title,
    project_id: project.id,
  });

  return NextResponse.json({ ok: true, id: project.id });
}

async function distributeLeadsInBackground(
  projectId: string,
  categoryIds: string[],
) {
  if (categoryIds.length === 0) return;
  const admin = createAdminClient();

  const { data: matchingTenants } = await admin
    .from("tenant_categories")
    .select("tenant_id, tenants!inner(id, status)")
    .in("category_id", categoryIds);

  const active = (matchingTenants ?? []).filter(
    // @ts-expect-error — join typing
    (row) => row.tenants?.status === "active",
  );

  // Deduplicate tenants
  const tenantIds = Array.from(new Set(active.map((r) => r.tenant_id)));

  // Taket kommer fra kategorien (strengeste ved flere), Elite foran Pro foran gratis
  const limit = await maxRecipientsForCategories(categoryIds);
  const selected = await prioritizeTenants(tenantIds, limit);

  if (selected.length === 0) return;

  await admin.from("project_leads").insert(
    selected.map((tenant_id) => ({
      project_id: projectId,
      tenant_id,
    })),
  );

  // Also create a default pipeline card in each matching tenant's first stage
  for (const tenant_id of selected) {
    const { data: firstStage } = await admin
      .from("pipeline_stages")
      .select("id")
      .eq("tenant_id", tenant_id)
      .order("sort_order")
      .limit(1)
      .single();
    if (firstStage) {
      await admin.from("pipeline_cards").insert({
        tenant_id,
        project_id: projectId,
        stage_id: firstStage.id,
      });
    }
  }

  // Email each matching tenant about the new lead
  const { data: project } = await admin
    .from("projects")
    .select("title, description, budget_min_nok, budget_max_nok")
    .eq("id", projectId)
    .maybeSingle();
  if (project) {
    for (const tenant_id of selected) {
      queueEmail({
        type: "new_lead",
        to_tenant_id: tenant_id,
        project_title: project.title,
        project_description: project.description,
        budget_min_nok: project.budget_min_nok,
        budget_max_nok: project.budget_max_nok,
        project_id: projectId,
      });
    }
  }
}
