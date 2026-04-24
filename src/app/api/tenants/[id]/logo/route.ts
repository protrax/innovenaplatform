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

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const ext = parsed.data.filename.split(".").pop()?.toLowerCase() ?? "png";
  const safeExt = ["jpg", "jpeg", "png", "webp", "svg"].includes(ext)
    ? ext
    : "png";
  const storagePath = `${id}/logo-${Date.now()}.${safeExt}`;

  const { data: signed, error } = await supabase.storage
    .from("tenant-assets")
    .createSignedUploadUrl(storagePath);
  if (error || !signed) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke lage opplastingslenke" },
      { status: 500 },
    );
  }

  const publicUrl = supabase.storage
    .from("tenant-assets")
    .getPublicUrl(storagePath).data.publicUrl;

  await supabase.from("tenants").update({ logo_url: publicUrl }).eq("id", id);

  return NextResponse.json({
    ok: true,
    upload_url: signed.signedUrl,
    public_url: publicUrl,
  });
}
