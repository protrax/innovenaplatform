import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  project_id: z.string().uuid(),
  amount_nok: z.number().int().min(100),
  description: z.string().min(3).max(500),
  due_date: z.string().optional(),
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
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { project_id, amount_nok, description, due_date } = parsed.data;

  // Must be a tenant member with a lead on this project
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id);
  if (!membership || membership.length === 0) {
    return NextResponse.json({ error: "No tenant membership" }, { status: 403 });
  }

  const tenantIds = membership.map((m) => m.tenant_id);
  const { data: lead } = await supabase
    .from("project_leads")
    .select("tenant_id")
    .eq("project_id", project_id)
    .in("tenant_id", tenantIds)
    .limit(1)
    .maybeSingle();
  if (!lead) {
    return NextResponse.json(
      { error: "Din tenant har ikke tilgang til dette prosjektet" },
      { status: 403 },
    );
  }
  const tenantId = lead.tenant_id;

  const { data: project } = await supabase
    .from("projects")
    .select("customer_id")
    .eq("id", project_id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("platform_fee_enabled, platform_fee_percent")
    .eq("id", tenantId)
    .maybeSingle();

  const platformFeeEnabled = tenant?.platform_fee_enabled ?? true;
  const platformFeePercent = Number(tenant?.platform_fee_percent ?? 2.5);
  const platformFeeNok = platformFeeEnabled
    ? Math.round((amount_nok * platformFeePercent) / 100)
    : 0;
  const totalNok = amount_nok + platformFeeNok;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      tenant_id: tenantId,
      customer_id: project.customer_id,
      amount_nok,
      platform_fee_nok: platformFeeNok,
      total_nok: totalNok,
      status: "draft",
      description,
      due_date: due_date ?? null,
      platform_fee_enabled: platformFeeEnabled,
      platform_fee_percent: platformFeePercent,
    })
    .select()
    .single();

  if (error || !invoice) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke opprette faktura" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, invoice });
}
