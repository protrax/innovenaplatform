import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: file } = await supabase
    .from("project_files")
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Delete storage object (RLS policy allows the uploader/admin)
  const { error: storageError } = await supabase.storage
    .from("project-files")
    .remove([file.storage_path]);
  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { error } = await supabase.from("project_files").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
