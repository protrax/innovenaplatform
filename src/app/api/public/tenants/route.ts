import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const revalidate = 60;

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category"); // slug
  const type = url.searchParams.get("type"); // 'agency' | 'solo_consultant'
  const q = url.searchParams.get("q");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 24), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  const admin = createAdminClient();
  let query = admin
    .from("tenants")
    .select(
      // case_studies er med for at innovena.no skal få case-sidene inn i
      // sitemapet uten å slå opp hvert byrå enkeltvis. Kun id og tittel —
      // resten hentes på profil-endepunktet når siden faktisk rendres.
      `id, slug, name, type, logo_url, tagline, description, website, location,
       founded_year, team_size, linkedin_url, instagram_url,
       tenant_categories:tenant_categories(category_id, service_categories(slug, name)),
       case_studies:case_studies(id, title, published)`,
      { count: "exact" },
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq("type", type);
  if (q) {
    query = query.or(
      `name.ilike.%${q}%,tagline.ilike.%${q}%,description.ilike.%${q}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors() });
  }

  let tenants = data ?? [];
  if (category) {
    tenants = tenants.filter((t) => {
      const cats = t.tenant_categories as unknown as Array<{
        service_categories: { slug: string } | null;
      }>;
      return cats.some((c) => c.service_categories?.slug === category);
    });
  }

  const results = tenants.map((t) => {
    const cats = t.tenant_categories as unknown as Array<{
      service_categories: { slug: string; name: string } | null;
    }>;
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      type: t.type,
      logo_url: t.logo_url,
      tagline: t.tagline,
      description: t.description,
      website: t.website,
      location: t.location,
      founded_year: t.founded_year,
      team_size: t.team_size,
      linkedin_url: t.linkedin_url,
      instagram_url: t.instagram_url,
      categories: cats
        .filter((c) => c.service_categories)
        .map((c) => c.service_categories!),
      cases: (
        t.case_studies as unknown as Array<{
          id: string;
          title: string;
          published: boolean;
        }>
      )
        .filter((c) => c.published)
        .map((c) => ({ id: c.id, title: c.title })),
      profile_url: `/byraaer/${t.slug}`,
    };
  });

  return NextResponse.json(
    { tenants: results, total: count ?? results.length, limit, offset },
    { headers: cors() },
  );
}
