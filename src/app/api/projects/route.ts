import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";

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

  // Fire-and-forget lead distribution (admin client bypasses RLS for cross-tenant writes)
  distributeLeadsInBackground(project.id, category_ids).catch((err) => {
    console.error("lead distribution failed", err);
  });

  // Confirmation email to the customer that their brief is out there.
  void sendEmail({
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

  // Hard cap: max 5 tenants per lead (will read from category config in a later phase)
  const selected = tenantIds.slice(0, 5);

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
      void sendEmail({
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
