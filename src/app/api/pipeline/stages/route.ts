import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PostBody = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  color: z.string().max(16).optional(),
  is_won: z.boolean().optional(),
  is_lost: z.boolean().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = PostBody.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Must be tenant owner/admin
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Append to end: get max sort_order
  const { data: existing } = await supabase
    .from("pipeline_stages")
    .select("sort_order")
    .eq("tenant_id", parsed.data.tenant_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (existing?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert({
      tenant_id: parsed.data.tenant_id,
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      is_won: parsed.data.is_won ?? false,
      is_lost: parsed.data.is_lost ?? false,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke lage stadium" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, stage: data });
}
