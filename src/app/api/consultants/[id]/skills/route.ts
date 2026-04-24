import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PostBody = z.object({
  category_id: z.string().uuid().nullable().optional(),
  skill_name: z.string().min(1).max(80).nullable().optional(),
});

export async function POST(
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

  const parsed = PostBody.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (!parsed.data.category_id && !parsed.data.skill_name) {
    return NextResponse.json(
      { error: "category_id eller skill_name må settes" },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("consultant_skills").insert({
    consultant_id: id,
    category_id: parsed.data.category_id ?? null,
    skill_name: parsed.data.skill_name ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category_id");
  const skillName = url.searchParams.get("skill_name");

  const supabase = await createClient();

  let query = supabase
    .from("consultant_skills")
    .delete()
    .eq("consultant_id", id);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (skillName) query = query.eq("skill_name", skillName);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
