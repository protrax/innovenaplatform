import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PostBody = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  visibility: z.enum(["shared", "internal"]).default("shared"),
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

  // Find the tenant this user belongs to that has a lead on the project
  const { data: memberships } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id);
  const tenantIds = (memberships ?? []).map((m) => m.tenant_id);
  if (tenantIds.length === 0) {
    return NextResponse.json({ error: "No tenant membership" }, { status: 403 });
  }
  const { data: lead } = await supabase
    .from("project_leads")
    .select("tenant_id")
    .eq("project_id", parsed.data.project_id)
    .in("tenant_id", tenantIds)
    .limit(1)
    .maybeSingle();
  if (!lead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: maxRow } = await supabase
    .from("project_tasks")
    .select("sort_order")
    .eq("tenant_id", lead.tenant_id)
    .eq("project_id", parsed.data.project_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("project_tasks")
    .insert({
      project_id: parsed.data.project_id,
      tenant_id: lead.tenant_id,
      created_by: user.id,
      assigned_to: parsed.data.assigned_to ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      due_date: parsed.data.due_date ?? null,
      visibility: parsed.data.visibility,
      sort_order: nextOrder,
      status: "todo",
    })
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke lage oppgave" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, task: data });
}
