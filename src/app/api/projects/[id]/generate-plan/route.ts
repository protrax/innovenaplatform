import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndSaveProjectPlan } from "@/lib/project-plan";

export const runtime = "nodejs";
export const maxDuration = 60;

// Manually regenerate the AI project plan for a project. Only a tenant
// member on the winning contract (or admin) can trigger this.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Need a signed contract to know which tenant owns execution
  const { data: contract } = await admin
    .from("contracts")
    .select("tenant_id, customer_id, bid_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!contract) {
    return NextResponse.json(
      { error: "Prosjektet har ingen signert kontrakt" },
      { status: 400 },
    );
  }

  // Auth: caller must be a member of that tenant
  const { data: membership } = await admin
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("tenant_id", contract.tenant_id)
    .maybeSingle();
  const { data: isAdmin } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!membership && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ data: project }, { data: bid }, { data: tenant }] = await Promise.all([
    admin
      .from("projects")
      .select("title, description")
      .eq("id", projectId)
      .maybeSingle(),
    admin
      .from("bids")
      .select("amount_nok, delivery_weeks, summary, description, includes")
      .eq("id", contract.bid_id)
      .maybeSingle(),
    admin
      .from("tenants")
      .select("name")
      .eq("id", contract.tenant_id)
      .maybeSingle(),
  ]);

  if (!project || !bid) {
    return NextResponse.json({ error: "Prosjekt eller tilbud mangler" }, { status: 404 });
  }

  try {
    const result = await generateAndSaveProjectPlan({
      projectId,
      tenantId: contract.tenant_id,
      customerId: contract.customer_id,
      createdById: user.id,
      input: {
        projectTitle: project.title,
        projectDescription: project.description,
        tenantName: tenant?.name ?? "Byrå",
        amountNok: bid.amount_nok,
        deliveryWeeks: bid.delivery_weeks,
        bidSummary: bid.summary ?? "",
        bidDescription: bid.description,
        bidIncludes: bid.includes ?? [],
      },
    });
    return NextResponse.json({ ok: true, tasks_inserted: result.tasksInserted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ukjent feil" },
      { status: 500 },
    );
  }
}
