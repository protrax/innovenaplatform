import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  tenant_id: z.string().uuid(),
  full_name: z.string().min(2).max(120),
  title: z.string().max(120).optional(),
  bio: z.string().max(4000).optional(),
  hourly_rate_nok: z.number().int().min(0).max(10000).nullable().optional(),
  years_experience: z.number().int().min(0).max(70).nullable().optional(),
  location: z.string().max(120).optional(),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
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

  // Must be owner/admin of the tenant
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build a unique slug
  const baseSlug = slugify(parsed.data.full_name) || `konsulent-${Date.now().toString(36)}`;
  let slug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const { data: exists } = await supabase
      .from("consultant_profiles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!exists) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data, error } = await supabase
    .from("consultant_profiles")
    .insert({
      tenant_id: parsed.data.tenant_id,
      slug,
      full_name: parsed.data.full_name,
      title: parsed.data.title ?? null,
      bio: parsed.data.bio ?? null,
      hourly_rate_nok: parsed.data.hourly_rate_nok ?? null,
      years_experience: parsed.data.years_experience ?? null,
      location: parsed.data.location ?? null,
      visible_in_marketplace: false,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke opprette konsulent" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, consultant: data });
}
