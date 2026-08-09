import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prioritizeTenants } from "@/lib/lead-distribution";
import { queueEmail } from "@/lib/email/send";
import { requireAdmin } from "../../admin-guard";

export const runtime = "nodejs";

/**
 * Kjører fordelingen på nytt for en forespørsel.
 *
 * Trengs fordi en forespørsel kan komme inn i et øyeblikk der ingen byråer
 * matcher — nye kategorier, alle suspendert, eller ingen godkjent ennå — og da
 * blir den liggende som «Ikke distribuert» for alltid. Uten denne knappen må
 * kunden sende inn på nytt, og det gjør de ikke.
 *
 * Byråer som allerede har fått forespørselen hoppes over, så knappen kan
 * trykkes flere ganger uten å spamme noen.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (guard) return guard;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: project } = await admin
    .from("projects")
    .select("id, title, description, budget_min_nok, budget_max_nok")
    .eq("id", id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Fant ikke forespørselen" }, { status: 404 });
  }

  const { data: cats } = await admin
    .from("project_categories")
    .select("category_id")
    .eq("project_id", id);
  const categoryIds = (cats ?? []).map((c) => c.category_id);
  if (categoryIds.length === 0) {
    return NextResponse.json(
      { error: "Forespørselen har ingen kategorier å matche på" },
      { status: 422 },
    );
  }

  const { data: matching } = await admin
    .from("tenant_categories")
    .select("tenant_id, tenants!inner(status)")
    .in("category_id", categoryIds);
  const active = (matching ?? []).filter(
    // @ts-expect-error — joinet relasjon
    (r) => r.tenants?.status === "active",
  );

  const { data: already } = await admin
    .from("project_leads")
    .select("tenant_id")
    .eq("project_id", id);
  const alreadySent = new Set((already ?? []).map((r) => r.tenant_id));

  const candidates = Array.from(
    new Set(active.map((r) => r.tenant_id)),
  ).filter((tid) => !alreadySent.has(tid));

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      added: 0,
      message:
        alreadySent.size > 0
          ? "Alle matchende byråer har allerede fått denne."
          : "Ingen aktive byråer matcher kategoriene. Godkjenn et byrå først.",
    });
  }

  const tenantIds = await prioritizeTenants(candidates);

  await admin
    .from("project_leads")
    .insert(tenantIds.map((tenant_id) => ({ project_id: id, tenant_id })));

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
        project_id: id,
        stage_id: firstStage.id,
      });
    }
    queueEmail({
      type: "new_lead",
      to_tenant_id: tenant_id,
      project_title: project.title,
      project_description: project.description ?? "",
      budget_min_nok: project.budget_min_nok ?? null,
      budget_max_nok: project.budget_max_nok ?? null,
      project_id: id,
    });
  }

  console.log(
    `[admin] Redistribuerte ${id} til ${tenantIds.length} byrå(er)`,
  );
  return NextResponse.json({
    ok: true,
    added: tenantIds.length,
    message: `Sendt til ${tenantIds.length} byrå.`,
  });
}
