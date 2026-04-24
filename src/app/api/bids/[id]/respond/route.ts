import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildContractBody } from "@/lib/contracts";
import { sendEmail } from "@/lib/email/send";
import { generateAndSaveProjectPlan } from "@/lib/project-plan";

export const runtime = "nodejs";

const Body = z.object({
  action: z.enum(["accept", "reject"]),
  reason: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bidId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { data: bid } = await supabase
    .from("bids")
    .select(
      "id, status, amount_nok, delivery_weeks, summary, description, includes, project_id, tenant_id, projects!inner(id, customer_id, title, description)",
    )
    .eq("id", bidId)
    .maybeSingle();
  if (!bid) {
    return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  }
  const project = bid.projects as unknown as {
    id: string;
    customer_id: string;
    title: string;
    description: string;
  };
  if (project.customer_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["sent", "viewed"].includes(bid.status)) {
    return NextResponse.json(
      { error: `Kan ikke svare på tilbud med status ${bid.status}` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (parsed.data.action === "reject") {
    await admin
      .from("bids")
      .update({
        status: "rejected",
        rejected_reason: parsed.data.reason ?? null,
        responded_at: now,
      })
      .eq("id", bidId);

    const { data: lostStage } = await admin
      .from("pipeline_stages")
      .select("id")
      .eq("tenant_id", bid.tenant_id)
      .eq("is_lost", true)
      .limit(1)
      .maybeSingle();
    if (lostStage) {
      await admin
        .from("pipeline_cards")
        .update({ stage_id: lostStage.id })
        .eq("tenant_id", bid.tenant_id)
        .eq("project_id", project.id);
    }
    void sendEmail({
      type: "bid_rejected",
      to_tenant_id: bid.tenant_id,
      project_title: project.title,
      reason: parsed.data.reason ?? null,
    });
    return NextResponse.json({ ok: true });
  }

  // --- ACCEPT ---
  const [{ data: tenant }, { data: customer }] = await Promise.all([
    admin
      .from("tenants")
      .select("name, org_number")
      .eq("id", bid.tenant_id)
      .maybeSingle(),
    admin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
  ]);

  const body = buildContractBody({
    projectTitle: project.title,
    projectDescription: project.description,
    tenantName: tenant?.name ?? "Byrå",
    tenantOrgNumber: tenant?.org_number ?? null,
    customerName: customer?.full_name ?? customer?.email ?? "Kunde",
    customerEmail: customer?.email ?? "",
    amountNok: bid.amount_nok,
    deliveryWeeks: bid.delivery_weeks,
    bidSummary: bid.summary ?? "",
    bidDescription: bid.description,
    bidIncludes: bid.includes ?? [],
  });

  const forwardedFor = request.headers.get("x-forwarded-for");
  const customerIp = forwardedFor?.split(",")[0].trim() ?? null;
  const customerUa = request.headers.get("user-agent") ?? null;

  const { data: contract, error: contractError } = await admin
    .from("contracts")
    .insert({
      bid_id: bid.id,
      project_id: project.id,
      tenant_id: bid.tenant_id,
      customer_id: user.id,
      amount_nok: bid.amount_nok,
      status: "signed",
      title: body.title,
      summary: body.summary,
      body_markdown: body.body_markdown,
      terms_markdown: body.terms_markdown,
      customer_signed_at: now,
      customer_signed_ip: customerIp,
      customer_signed_user_agent: customerUa,
      tenant_signed_at: now,
    })
    .select()
    .single();

  if (contractError || !contract) {
    return NextResponse.json(
      { error: contractError?.message ?? "Kunne ikke opprette kontrakt" },
      { status: 500 },
    );
  }

  await admin
    .from("bids")
    .update({ status: "accepted", responded_at: now })
    .eq("id", bid.id);

  // Capture losing tenants before we mark them rejected (so we can email them)
  const { data: losingBids } = await admin
    .from("bids")
    .select("tenant_id")
    .eq("project_id", project.id)
    .neq("id", bid.id)
    .in("status", ["sent", "viewed", "draft"]);

  await admin
    .from("bids")
    .update({
      status: "rejected",
      rejected_reason: "Kunden valgte et annet tilbud",
      responded_at: now,
    })
    .eq("project_id", project.id)
    .neq("id", bid.id)
    .in("status", ["sent", "viewed", "draft"]);

  await admin
    .from("projects")
    .update({ status: "in_progress", phase: "oppstart" })
    .eq("id", project.id);

  const { data: stages } = await admin
    .from("pipeline_stages")
    .select("id, tenant_id, is_won, is_lost");
  const wonByTenant = new Map<string, string>();
  const lostByTenant = new Map<string, string>();
  for (const s of stages ?? []) {
    if (s.is_won) wonByTenant.set(s.tenant_id, s.id);
    if (s.is_lost) lostByTenant.set(s.tenant_id, s.id);
  }
  const winnerStage = wonByTenant.get(bid.tenant_id);
  if (winnerStage) {
    await admin
      .from("pipeline_cards")
      .update({ stage_id: winnerStage })
      .eq("tenant_id", bid.tenant_id)
      .eq("project_id", project.id);
  }

  const { data: otherCards } = await admin
    .from("pipeline_cards")
    .select("id, tenant_id")
    .eq("project_id", project.id)
    .neq("tenant_id", bid.tenant_id);
  for (const c of otherCards ?? []) {
    const lostStage = lostByTenant.get(c.tenant_id);
    if (lostStage) {
      await admin
        .from("pipeline_cards")
        .update({ stage_id: lostStage })
        .eq("id", c.id);
    }
  }

  // Fire-and-forget: generate an AI project plan so the workspace is
  // populated with tasks the moment the customer opens it.
  void generateAndSaveProjectPlan({
    projectId: project.id,
    tenantId: bid.tenant_id,
    customerId: user.id,
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
  }).catch((err) => console.error("[respond] project plan failed:", err));

  // Email winning tenant
  void sendEmail({
    type: "bid_accepted",
    to_tenant_id: bid.tenant_id,
    project_title: project.title,
    amount_nok: bid.amount_nok,
    customer_name: customer?.full_name ?? customer?.email ?? "Kunde",
    contract_id: contract.id,
  });

  // Email losing tenants
  for (const lb of losingBids ?? []) {
    void sendEmail({
      type: "bid_rejected",
      to_tenant_id: lb.tenant_id,
      project_title: project.title,
      reason: "Kunden valgte et annet tilbud",
    });
  }

  return NextResponse.json({ ok: true, contract_id: contract.id });
}
