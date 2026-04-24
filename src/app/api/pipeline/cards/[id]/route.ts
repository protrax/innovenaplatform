import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PatchBody = z.object({
  stage_id: z.string().uuid().optional(),
  sort_order: z.number().int().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = PatchBody.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { data: card } = await supabase
    .from("pipeline_cards")
    .select("id, tenant_id, stage_id")
    .eq("id", id)
    .maybeSingle();
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.stage_id !== undefined) update.stage_id = parsed.data.stage_id;
  if (parsed.data.sort_order !== undefined)
    update.sort_order = parsed.data.sort_order;
  if (parsed.data.assigned_to !== undefined)
    update.assigned_to = parsed.data.assigned_to;
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;

  const { error } = await supabase
    .from("pipeline_cards")
    .update(update)
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity (fire-and-forget)
  if (
    parsed.data.stage_id !== undefined &&
    parsed.data.stage_id !== card.stage_id
  ) {
    await supabase.from("pipeline_activity").insert({
      tenant_id: card.tenant_id,
      card_id: id,
      actor_id: user.id,
      activity_type: "stage_changed",
      from_value: card.stage_id,
      to_value: parsed.data.stage_id,
    });
  }

  return NextResponse.json({ ok: true });
}
