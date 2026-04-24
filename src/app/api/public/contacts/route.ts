import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Public webhook for tenants to push contacts into their CRM from their own
// website form, Zapier, n8n, etc. Auth is the tenant's webhook_key — rotate
// it in settings if it leaks.
const Body = z.object({
  full_name: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string()).max(20).optional(),
  source: z.string().max(80).optional(),
  lifecycle_stage: z
    .enum(["subscriber", "lead", "customer", "lost"])
    .optional(),
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
    return NextResponse.json(
      { error: "Missing key" },
      { status: 401, headers: cors() },
    );
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, status")
    .eq("webhook_key", key)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json(
      { error: "Invalid key" },
      { status: 401, headers: cors() },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400, headers: cors() },
    );
  }

  const payload = parsed.data;
  if (!payload.email && !payload.phone && !payload.full_name) {
    return NextResponse.json(
      { error: "Must provide at least full_name, email, or phone" },
      { status: 400, headers: cors() },
    );
  }

  // Dedupe on (tenant_id, email) when email present — update instead of insert.
  if (payload.email) {
    const { data: existing } = await admin
      .from("contacts")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("email", payload.email)
      .maybeSingle();
    if (existing) {
      const patch: Record<string, unknown> = {};
      if (payload.full_name) patch.full_name = payload.full_name;
      if (payload.phone) patch.phone = payload.phone;
      if (payload.company) patch.company = payload.company;
      if (payload.notes) patch.notes = payload.notes;
      if (payload.tags) patch.tags = payload.tags;
      if (payload.lifecycle_stage) patch.lifecycle_stage = payload.lifecycle_stage;
      if (Object.keys(patch).length > 0) {
        await admin.from("contacts").update(patch).eq("id", existing.id);
      }
      return NextResponse.json(
        { ok: true, id: existing.id, updated: true },
        { headers: cors() },
      );
    }
  }

  const { data: contact, error } = await admin
    .from("contacts")
    .insert({
      tenant_id: tenant.id,
      full_name: payload.full_name ?? null,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      company: payload.company ?? null,
      notes: payload.notes ?? null,
      tags: payload.tags ?? [],
      source: payload.source ?? "webhook",
      lifecycle_stage: payload.lifecycle_stage ?? "lead",
    })
    .select("id")
    .single();
  if (error || !contact) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create contact" },
      { status: 500, headers: cors() },
    );
  }

  return NextResponse.json(
    { ok: true, id: contact.id },
    { headers: cors() },
  );
}
