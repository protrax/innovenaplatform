import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: file } = await supabase
    .from("project_files")
    .select("storage_path, filename")
    .eq("id", id)
    .maybeSingle();
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from("project-files")
    .createSignedUrl(file.storage_path, 300, { download: file.filename });
  if (error || !signed) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke lage nedlastingslenke" },
      { status: 500 },
    );
  }
  return NextResponse.redirect(signed.signedUrl);
}
