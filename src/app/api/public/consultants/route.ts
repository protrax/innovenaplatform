import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Cache for 60s at the edge — profiles don't change minute-to-minute
export const revalidate = 60;

// Public consultant listing. No auth required. Only returns consultants that
// are visible_in_marketplace AND whose tenant is active. Uses the admin client
// server-side because this is a public endpoint with no user session; every
// filter we apply is explicit here so there's no data leak risk.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category"); // slug
  const minRate = url.searchParams.get("min_rate");
  const maxRate = url.searchParams.get("max_rate");
  const availableNow = url.searchParams.get("available_now") === "true";
  const search = url.searchParams.get("q");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  const admin = createAdminClient();

  let query = admin
    .from("consultant_profiles")
    .select(
      `id, slug, full_name, title, headline, bio, avatar_url,
       hourly_rate_nok, years_experience, available_from,
       available_hours_per_week, location, languages, linkedin_url,
       portfolio_url, created_at,
       tenant:tenants!inner(id, name, slug, type, status),
       skills:consultant_skills(category_id, skill_name, service_categories(slug, name))`,
      { count: "exact" },
    )
    .eq("visible_in_marketplace", true)
    .eq("tenants.status", "active")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (minRate) query = query.gte("hourly_rate_nok", Number(minRate));
  if (maxRate) query = query.lte("hourly_rate_nok", Number(maxRate));
  if (availableNow) {
    query = query.lte("available_from", new Date().toISOString().slice(0, 10));
  }
  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,title.ilike.%${search}%,headline.ilike.%${search}%,bio.ilike.%${search}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by category (slug) application-side since it requires nested match
  let rows = data ?? [];
  if (category) {
    rows = rows.filter((r) => {
      // @ts-expect-error — nested join shape
      const skills = r.skills as Array<{
        service_categories?: { slug: string };
      }>;
      return skills.some((s) => s.service_categories?.slug === category);
    });
  }

  const consultants = rows.map((r) => {
    // @ts-expect-error — Supabase join types
    const tenant = r.tenant as {
      id: string;
      name: string;
      slug: string;
      type: string;
    };
    // @ts-expect-error — skills join
    const skillsRaw = r.skills as Array<{
      category_id: string | null;
      skill_name: string | null;
      service_categories: { slug: string; name: string } | null;
    }>;
    const skills = skillsRaw.map((s) => ({
      category_slug: s.service_categories?.slug ?? null,
      category_name: s.service_categories?.name ?? null,
      skill_name: s.skill_name,
    }));
    return {
      id: r.id,
      slug: r.slug,
      full_name: r.full_name,
      title: r.title,
      headline: r.headline,
      bio: r.bio,
      avatar_url: r.avatar_url,
      hourly_rate_nok: r.hourly_rate_nok,
      years_experience: r.years_experience,
      available_from: r.available_from,
      available_hours_per_week: r.available_hours_per_week,
      location: r.location,
      languages: r.languages,
      linkedin_url: r.linkedin_url,
      portfolio_url: r.portfolio_url,
      skills,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        type: tenant.type,
      },
      profile_url: `/konsulenter/${r.slug}`,
    };
  });

  return NextResponse.json({
    consultants,
    total: count ?? consultants.length,
    limit,
    offset,
  });
}
