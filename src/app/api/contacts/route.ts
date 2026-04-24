import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  full_name: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string()).max(20).optional(),
  lifecycle_stage: z
    .enum(["subscriber", "lead", "customer", "lost"])
    .default("lead"),
  // If true and email/phone/name present, also create a pipeline card in
  // first stage so the new contact shows up in pipeline immediately.
  create_pipeline_card: z.boolean().optional(),
  value_nok: z.number().int().min(0).nullable().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: member } = await supabase
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "No tenant" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const p = parsed.data;
  if (!p.email && !p.phone && !p.full_name) {
    return NextResponse.json(
      { error: "Oppgi minst navn, e-post eller telefon." },
      { status: 400 },
    );
  }

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      tenant_id: member.tenant_id,
      full_name: p.full_name ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      company: p.company ?? null,
      notes: p.notes ?? null,
      tags: p.tags ?? [],
      source: "manual",
      lifecycle_stage: p.lifecycle_stage,
    })
    .select()
    .single();
  if (error || !contact) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke opprette kontakt" },
      { status: 500 },
    );
  }

  if (p.create_pipeline_card) {
    const { data: firstStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("tenant_id", member.tenant_id)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (firstStage) {
      await supabase.from("pipeline_cards").insert({
        tenant_id: member.tenant_id,
        contact_id: contact.id,
        stage_id: firstStage.id,
        title: contact.full_name ?? contact.company ?? contact.email ?? "Lead",
        value_nok: p.value_nok ?? null,
        notes: p.notes ?? null,
      });
    }
  }

  return NextResponse.json({ ok: true, id: contact.id });
}
