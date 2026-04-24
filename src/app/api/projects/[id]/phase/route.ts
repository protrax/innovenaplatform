import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  phase: z.enum([
    "oppstart",
    "design",
    "utvikling",
    "review",
    "levering",
    "fullfort",
  ]),
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
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Only tenants with an active/signed contract on this project can update phase
  const { data: contract } = await supabase
    .from("contracts")
    .select("tenant_id")
    .eq("project_id", id)
    .in("status", ["signed", "active", "completed"])
    .maybeSingle();
  if (!contract) {
    return NextResponse.json(
      { error: "Prosjektet har ingen aktiv kontrakt" },
      { status: 400 },
    );
  }
  const { data: member } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("tenant_id", contract.tenant_id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Mark complete when moving to fullfort
  const updates: { phase: string; status?: string } = { phase: parsed.data.phase };
  if (parsed.data.phase === "fullfort") updates.status = "completed";

  const { error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
