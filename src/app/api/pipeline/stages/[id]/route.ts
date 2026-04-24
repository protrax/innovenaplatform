import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PatchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().max(16).nullable().optional(),
  sort_order: z.number().int().optional(),
  is_won: z.boolean().optional(),
  is_lost: z.boolean().optional(),
});

async function requireStageAccess(stageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" as const };
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id, tenant_id")
    .eq("id", stageId)
    .maybeSingle();
  if (!stage) return { error: "not_found" as const };
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", stage.tenant_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "forbidden" as const };
  }
  return { supabase, stage };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireStageAccess(id);
  if ("error" in access) {
    const status =
      access.error === "unauthenticated" ? 401 :
      access.error === "not_found" ? 404 : 403;
    return NextResponse.json({ error: access.error }, { status });
  }

  const parsed = PatchBody.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { error } = await access.supabase
    .from("pipeline_stages")
    .update(parsed.data)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireStageAccess(id);
  if ("error" in access) {
    const status =
      access.error === "unauthenticated" ? 401 :
      access.error === "not_found" ? 404 : 403;
    return NextResponse.json({ error: access.error }, { status });
  }

  // Don't allow deletion if any cards live here — UX: ask user to move cards first
  const { count } = await access.supabase
    .from("pipeline_cards")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", id);
  if (count && count > 0) {
    return NextResponse.json(
      { error: `Flytt kortene i dette stadiet først (${count} kort)` },
      { status: 400 },
    );
  }

  const { error } = await access.supabase
    .from("pipeline_stages")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
