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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select(
      `*,
       tenant_categories:tenant_categories(category_id, service_categories(slug, name)),
       case_studies:case_studies(id, title, client_name, description, challenge, solution, result, cover_image_url, project_url, categories, sort_order, published, created_at),
       consultants:consultant_profiles(id, slug, full_name, title, headline, avatar_url, hourly_rate_nok, visible_in_marketplace)`,
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: cors() },
    );
  }

  const categories = (
    tenant.tenant_categories as unknown as Array<{
      service_categories: { slug: string; name: string } | null;
    }>
  )
    .filter((c) => c.service_categories)
    .map((c) => c.service_categories!);

  const caseStudies = (
    tenant.case_studies as unknown as Array<{
      id: string;
      title: string;
      client_name: string | null;
      description: string | null;
      challenge: string | null;
      solution: string | null;
      result: string | null;
      cover_image_url: string | null;
      project_url: string | null;
      categories: string[] | null;
      sort_order: number;
      published: boolean;
    }>
  )
    .filter((c) => c.published)
    .sort((a, b) => a.sort_order - b.sort_order);

  const consultants = (
    tenant.consultants as unknown as Array<{
      id: string;
      slug: string;
      full_name: string;
      title: string | null;
      headline: string | null;
      avatar_url: string | null;
      hourly_rate_nok: number | null;
      visible_in_marketplace: boolean;
    }>
  ).filter((c) => c.visible_in_marketplace);

  return NextResponse.json(
    {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      type: tenant.type,
      logo_url: tenant.logo_url,
      tagline: tenant.tagline,
      description: tenant.description,
      website: tenant.website,
      founded_year: tenant.founded_year,
      team_size: tenant.team_size,
      location: tenant.location,
      linkedin_url: tenant.linkedin_url,
      instagram_url: tenant.instagram_url,
      twitter_url: tenant.twitter_url,
      categories,
      case_studies: caseStudies,
      consultants,
      profile_url: `/byraaer/${tenant.slug}`,
    },
    { headers: cors() },
  );
}
