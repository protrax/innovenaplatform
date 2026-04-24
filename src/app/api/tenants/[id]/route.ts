import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  tagline: z.string().max(200).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  website: z.string().url().nullable().optional(),
  founded_year: z.number().int().min(1900).max(2100).nullable().optional(),
  team_size: z.string().max(40).nullable().optional(),
  location: z.string().max(120).nullable().optional(),
  linkedin_url: z.string().url().nullable().optional(),
  instagram_url: z.string().url().nullable().optional(),
  twitter_url: z.string().url().nullable().optional(),
  org_number: z.string().max(40).nullable().optional(),
  billing_email: z.string().email().nullable().optional(),
  platform_fee_enabled: z.boolean().optional(),
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

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = PatchBody.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { error } = await supabase.from("tenants").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
