import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  project_id: z.string().uuid(),
  amount_nok: z.number().int().min(100),
  delivery_weeks: z.number().int().min(1).max(260).nullable(),
  summary: z.string().min(5).max(500),
  description: z.string().min(20),
  includes: z.array(z.string()).default([]),
});

// Upsert (one draft bid per tenant per project)
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

  // Find the tenant this user belongs to that has a lead on this project
  const { data: memberships } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id);
  const tenantIds = (memberships ?? []).map((m) => m.tenant_id);
  if (tenantIds.length === 0) {
    return NextResponse.json({ error: "No tenant membership" }, { status: 403 });
  }
  const { data: lead } = await supabase
    .from("project_leads")
    .select("tenant_id")
    .eq("project_id", parsed.data.project_id)
    .in("tenant_id", tenantIds)
    .limit(1)
    .maybeSingle();
  if (!lead) {
    return NextResponse.json(
      { error: "Din tenant har ikke tilgang til dette prosjektet" },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("bids")
    .upsert(
      {
        project_id: parsed.data.project_id,
        tenant_id: lead.tenant_id,
        amount_nok: parsed.data.amount_nok,
        delivery_weeks: parsed.data.delivery_weeks,
        summary: parsed.data.summary,
        description: parsed.data.description,
        includes: parsed.data.includes,
        status: "draft",
        submitted_by: user.id,
      },
      { onConflict: "project_id,tenant_id" },
    )
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke lagre tilbud" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, bid: data });
}
