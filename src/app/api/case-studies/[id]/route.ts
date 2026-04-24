import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PatchBody = z.object({
  title: z.string().min(1).max(200).optional(),
  client_name: z.string().max(120).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  challenge: z.string().max(4000).nullable().optional(),
  solution: z.string().max(4000).nullable().optional(),
  result: z.string().max(4000).nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  project_url: z.string().url().nullable().optional(),
  categories: z.array(z.string().max(80)).max(10).optional(),
  sort_order: z.number().int().optional(),
  published: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const parsed = PatchBody.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { error } = await supabase
    .from("case_studies")
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
  const supabase = await createClient();
  const { error } = await supabase.from("case_studies").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
