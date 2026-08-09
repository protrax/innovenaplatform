import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "../admin-guard";

export const runtime = "nodejs";

/**
 * Sletter en forespørsel permanent. Brukes til testinnsendinger, spam og
 * duplikater — uten dette må admin inn i Supabase for å rydde, og da er
 * portalen ikke lenger et komplett arbeidsverktøy.
 *
 * project_leads, bids og meldinger henger på med ON DELETE CASCADE, så raden
 * tar med seg alt som peker på den.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (guard) return guard;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: project } = await admin
    .from("projects")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Fant ikke forespørselen" }, { status: 404 });
  }

  const { error } = await admin.from("projects").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[admin] Slettet forespørsel ${id} ("${project.title}")`);
  return NextResponse.json({ ok: true });
}
