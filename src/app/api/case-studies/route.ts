import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  tenant_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  client_name: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
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

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: max } = await supabase
    .from("case_studies")
    .select("sort_order")
    .eq("tenant_id", parsed.data.tenant_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (max?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("case_studies")
    .insert({
      tenant_id: parsed.data.tenant_id,
      title: parsed.data.title,
      client_name: parsed.data.client_name ?? null,
      description: parsed.data.description ?? null,
      sort_order: nextOrder,
      published: false,
    })
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke lage case study" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, case_study: data });
}
