import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  tenant_id: z.string().uuid(),
  stage_ids: z.array(z.string().uuid()).min(1),
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
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Apply new sort orders one by one (simple — good enough for small pipelines)
  for (let i = 0; i < parsed.data.stage_ids.length; i++) {
    await supabase
      .from("pipeline_stages")
      .update({ sort_order: i })
      .eq("id", parsed.data.stage_ids[i])
      .eq("tenant_id", parsed.data.tenant_id);
  }

  return NextResponse.json({ ok: true });
}
