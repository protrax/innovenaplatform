import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyNOK } from "@/lib/utils";
import { MarketplaceFilters } from "./filters";
import { MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

type Search = Promise<{
  category?: string;
  q?: string;
  available_now?: string;
  min_rate?: string;
  max_rate?: string;
}>;

export default async function KonsulentMarkedsplass({
  searchParams,
}: {
  searchParams: Search;
}) {
  const sp = await searchParams;
  const admin = createAdminClient();

  const [consultantsQuery, categoriesRes] = await Promise.all([
    (async () => {
      let q = admin
        .from("consultant_profiles")
        .select(
          `id, slug, full_name, title, headline, avatar_url, hourly_rate_nok,
           years_experience, available_from, available_hours_per_week, location,
           tenant:tenants!inner(id, name, slug, type, status),
           skills:consultant_skills(category_id, skill_name, service_categories(slug, name))`,
        )
        .eq("visible_in_marketplace", true)
        .eq("tenants.status", "active")
        .order("created_at", { ascending: false })
        .limit(60);

      if (sp.min_rate) q = q.gte("hourly_rate_nok", Number(sp.min_rate));
      if (sp.max_rate) q = q.lte("hourly_rate_nok", Number(sp.max_rate));
      if (sp.available_now === "true") {
        q = q.lte("available_from", new Date().toISOString().slice(0, 10));
      }
      if (sp.q) {
        q = q.or(
          `full_name.ilike.%${sp.q}%,title.ilike.%${sp.q}%,headline.ilike.%${sp.q}%,bio.ilike.%${sp.q}%`,
        );
      }

      const { data } = await q;
      return data ?? [];
    })(),
    admin
      .from("service_categories")
      .select("id, slug, name")
      .eq("active", true)
      .order("sort_order"),
  ]);

  // Filter by category slug application-side (nested match)
  let consultants = consultantsQuery;
  if (sp.category) {
    consultants = consultants.filter((c) => {
      const skills = c.skills as unknown as Array<{
        service_categories: { slug: string } | null;
      }>;
      return skills.some((s) => s.service_categories?.slug === sp.category);
    });
  }

  const categories = categoriesRes.data ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-6 w-6 rounded-md bg-brand" aria-hidden />
            <span>Innovena Platform</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/logg-inn">Logg inn</Link>
            </Button>
            <Button asChild size="sm" variant="brand">
              <Link href="/registrer">Kom i gang</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Finn konsulent
          </h1>
          <p className="mt-2 text-muted-foreground">
            Uavhengige konsulenter og konsulenthus innen web, AI, markedsføring og
            mer. Filtrer for å finne riktig kompetanse.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside>
            <MarketplaceFilters categories={categories} current={sp} />
          </aside>

          <div>
            {consultants.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Ingen treff</CardTitle>
                  <CardDescription>
                    Prøv å justere filtrene eller søket. Markedsplassen fylles
                    opp etter hvert som byråer og solo-konsulenter publiserer
                    profilene sine.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {consultants.map((c) => (
                  <ConsultantCard key={c.id} consultant={c} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Innovena</span>
          <Link href="/api/public/consultants" className="font-mono text-xs">
            /api/public/consultants
          </Link>
        </div>
      </footer>
    </div>
  );
}

function ConsultantCard({ consultant }: { consultant: Record<string, unknown> }) {
  const c = consultant as {
    id: string;
    slug: string;
    full_name: string;
    title: string | null;
    headline: string | null;
    avatar_url: string | null;
    hourly_rate_nok: number | null;
    years_experience: number | null;
    available_hours_per_week: number | null;
    location: string | null;
    tenant: { name: string; type: string };
    skills: Array<{
      service_categories: { name: string } | null;
      skill_name: string | null;
    }>;
  };
  const topCategories = c.skills
    .filter((s) => s.service_categories)
    .slice(0, 3)
    .map((s) => s.service_categories!.name);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <Link href={`/konsulenter/${c.slug}`} className="block">
        <CardHeader>
          <div className="flex items-start gap-3">
            {c.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.avatar_url}
                alt={c.full_name}
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-sm font-semibold text-muted-foreground">
                {c.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">{c.full_name}</CardTitle>
              <CardDescription className="truncate">
                {c.title ?? c.headline ?? "Konsulent"}
              </CardDescription>
              {c.tenant.type === "solo_consultant" ? (
                <Badge variant="outline" className="mt-1 px-1.5 py-0 text-[10px]">
                  Solo
                </Badge>
              ) : (
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {c.tenant.name}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {topCategories.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {topCategories.map((cat) => (
                <Badge key={cat} variant="secondary" className="text-xs">
                  {cat}
                </Badge>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {c.hourly_rate_nok ? (
              <span className="font-semibold text-foreground">
                {formatCurrencyNOK(c.hourly_rate_nok)} / time
              </span>
            ) : null}
            {c.available_hours_per_week ? (
              <span>{c.available_hours_per_week}t/uke</span>
            ) : null}
            {c.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {c.location}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
