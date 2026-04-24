import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("consultant_profiles")
    .select(
      `id, slug, full_name, title, headline, bio, avatar_url,
       hourly_rate_nok, years_experience, available_from,
       available_hours_per_week, location, languages, linkedin_url,
       portfolio_url, created_at, visible_in_marketplace,
       tenant:tenants!inner(id, name, slug, type, status, description, website),
       skills:consultant_skills(category_id, skill_name, service_categories(slug, name))`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || !data.visible_in_marketplace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // @ts-expect-error — nested join
  if (data.tenant?.status !== "active") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
