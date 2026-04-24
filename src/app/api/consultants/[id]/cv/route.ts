import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const Body = z.object({
  filename: z.string().min(1).max(200),
  mime_type: z.string().optional(),
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

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { data: consultant } = await supabase
    .from("consultant_profiles")
    .select("id, tenant_id, cv_storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!consultant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = parsed.data.filename.split(".").pop()?.toLowerCase() ?? "pdf";
  const safeExt = ["pdf", "doc", "docx"].includes(ext) ? ext : "pdf";
  const storagePath = `${id}/cv-${Date.now()}.${safeExt}`;

  const { data: signed, error: signedError } = await supabase.storage
    .from("consultant-cvs")
    .createSignedUploadUrl(storagePath);
  if (signedError || !signed) {
    return NextResponse.json(
      { error: signedError?.message ?? "Kunne ikke lage opplastingslenke" },
      { status: 500 },
    );
  }

  // Clean up previous CV if any
  if (consultant.cv_storage_path) {
    const admin = createAdminClient();
    await admin.storage
      .from("consultant-cvs")
      .remove([consultant.cv_storage_path]);
  }

  await supabase
    .from("consultant_profiles")
    .update({
      cv_storage_path: storagePath,
      cv_filename: parsed.data.filename,
    })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    upload_url: signed.signedUrl,
    path: storagePath,
  });
}

// GET — signed download. Requires authentication (any logged-in user).
export async function GET(
  _request: Request,
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

  const { data: consultant } = await supabase
    .from("consultant_profiles")
    .select("cv_storage_path, cv_filename")
    .eq("id", id)
    .maybeSingle();
  if (!consultant?.cv_storage_path) {
    return NextResponse.json({ error: "No CV uploaded" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from("consultant-cvs")
    .createSignedUrl(consultant.cv_storage_path, 300, {
      download: consultant.cv_filename ?? "cv.pdf",
    });
  if (error || !signed) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke lage nedlastingslenke" },
      { status: 500 },
    );
  }
  return NextResponse.redirect(signed.signedUrl);
}
