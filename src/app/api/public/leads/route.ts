import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";

// Public webhook that creates (or reuses) a contact AND drops a new lead
// card into the tenant's first pipeline stage. Use this from a website
// contact form when you want the lead to show up in the pipeline immediately.
const Body = z.object({
  full_name: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  company: z.string().max(200).optional(),
  message: z.string().max(4000).optional(),
  title: z.string().max(200).optional(),
  value_nok: z.number().int().min(0).nullable().optional(),
  tags: z.array(z.string()).max(20).optional(),
  source: z.string().max(80).optional(),
});

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 401, headers: cors() });
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("webhook_key", key)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401, headers: cors() });
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400, headers: cors() },
    );
  }
  const p = parsed.data;
  if (!p.email && !p.phone && !p.full_name) {
    return NextResponse.json(
      { error: "Must provide at least full_name, email, or phone" },
      { status: 400, headers: cors() },
    );
  }

  // 1. Find or create contact (dedupe by email when given)
  let contactId: string | null = null;
  if (p.email) {
    const { data: existing } = await admin
      .from("contacts")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("email", p.email)
      .maybeSingle();
    if (existing) contactId = existing.id;
  }
  if (!contactId) {
    const { data: c, error: cErr } = await admin
      .from("contacts")
      .insert({
        tenant_id: tenant.id,
        full_name: p.full_name ?? null,
        email: p.email ?? null,
        phone: p.phone ?? null,
        company: p.company ?? null,
        notes: p.message ?? null,
        tags: p.tags ?? [],
        source: p.source ?? "webhook",
        lifecycle_stage: "lead",
      })
      .select("id")
      .single();
    if (cErr || !c) {
      return NextResponse.json(
        { error: cErr?.message ?? "Could not create contact" },
        { status: 500, headers: cors() },
      );
    }
    contactId = c.id;
  }

  // 2. Find first pipeline stage
  const { data: firstStage } = await admin
    .from("pipeline_stages")
    .select("id")
    .eq("tenant_id", tenant.id)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  if (!firstStage) {
    return NextResponse.json(
      { error: "Tenant has no pipeline stages configured" },
      { status: 500, headers: cors() },
    );
  }

  // 3. Create pipeline card. If a card already exists for this contact,
  // keep it where it is — don't clobber the tenant's manual progress.
  const { data: existingCard } = await admin
    .from("pipeline_cards")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("contact_id", contactId)
    .maybeSingle();
  if (existingCard) {
    return NextResponse.json(
      { ok: true, contact_id: contactId, card_id: existingCard.id, deduped: true },
      { headers: cors() },
    );
  }

  const title =
    p.title ?? p.company ?? p.full_name ?? p.email ?? "Ny lead";
  const { data: card, error: cardErr } = await admin
    .from("pipeline_cards")
    .insert({
      tenant_id: tenant.id,
      contact_id: contactId,
      stage_id: firstStage.id,
      title,
      value_nok: p.value_nok ?? null,
      notes: p.message ?? null,
    })
    .select("id")
    .single();
  if (cardErr || !card) {
    return NextResponse.json(
      { error: cardErr?.message ?? "Could not create pipeline card" },
      { status: 500, headers: cors() },
    );
  }

  void sendEmail({
    type: "new_contact_webhook",
    to_tenant_id: tenant.id,
    contact_name: p.full_name ?? p.email ?? p.phone ?? "Ny kontakt",
    source: p.source ?? "skjema",
    contact_id: contactId!,
  });

  return NextResponse.json(
    { ok: true, contact_id: contactId, card_id: card.id },
    { headers: cors() },
  );
}
