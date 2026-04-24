import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!consultant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = parsed.data.filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)
    ? ext
    : "jpg";
  const storagePath = `${id}/avatar-${Date.now()}.${safeExt}`;

  const { data: signed, error: signedError } = await supabase.storage
    .from("consultant-avatars")
    .createSignedUploadUrl(storagePath);
  if (signedError || !signed) {
    return NextResponse.json(
      { error: signedError?.message ?? "Kunne ikke lage opplastingslenke" },
      { status: 500 },
    );
  }

  // Store the public URL on the profile
  const publicUrl = supabase.storage
    .from("consultant-avatars")
    .getPublicUrl(storagePath).data.publicUrl;

  await supabase
    .from("consultant_profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    upload_url: signed.signedUrl,
    public_url: publicUrl,
    path: storagePath,
  });
}
