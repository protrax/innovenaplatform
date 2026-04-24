import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const PatchBody = z.object({
  full_name: z.string().min(2).max(120).optional(),
  title: z.string().max(120).nullable().optional(),
  headline: z.string().max(200).nullable().optional(),
  bio: z.string().max(4000).nullable().optional(),
  hourly_rate_nok: z.number().int().min(0).max(10000).nullable().optional(),
  years_experience: z.number().int().min(0).max(70).nullable().optional(),
  available_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  available_hours_per_week: z.number().int().min(0).max(80).nullable().optional(),
  location: z.string().max(120).nullable().optional(),
  languages: z.array(z.string().max(40)).max(10).optional(),
  linkedin_url: z.string().url().nullable().optional(),
  portfolio_url: z.string().url().nullable().optional(),
  visible_in_marketplace: z.boolean().optional(),
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

  const parsed = PatchBody.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("consultant_profiles")
    .update(parsed.data)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  // Fetch for storage cleanup
  const { data: consultant } = await supabase
    .from("consultant_profiles")
    .select("avatar_url, cv_storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("consultant_profiles")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort cleanup of storage assets (admin client bypasses RLS)
  if (consultant) {
    const admin = createAdminClient();
    if (consultant.cv_storage_path) {
      await admin.storage.from("consultant-cvs").remove([consultant.cv_storage_path]);
    }
    if (consultant.avatar_url) {
      // avatar_url stores path within the bucket (not a full URL) when we upload
      const maybePath = consultant.avatar_url.split("/consultant-avatars/")[1];
      if (maybePath) {
        await admin.storage.from("consultant-avatars").remove([maybePath]);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
