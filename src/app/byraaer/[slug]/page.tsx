import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { formatCurrencyNOK } from "@/lib/utils";
import { ExternalLink, MapPin, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TenantPublicProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select(
      `*,
       tenant_categories:tenant_categories(service_categories(slug, name)),
       case_studies:case_studies(*),
       consultants:consultant_profiles(id, slug, full_name, title, avatar_url, hourly_rate_nok, visible_in_marketplace)`,
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!tenant) notFound();

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
      avatar_url: string | null;
      hourly_rate_nok: number | null;
      visible_in_marketplace: boolean;
    }>
  ).filter((c) => c.visible_in_marketplace);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-6 w-6 rounded-md bg-brand" aria-hidden />
            <span>Innovena Platform</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/konsulenter">Finn konsulent</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-10">
        {/* Hero */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="h-24 w-24 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-accent text-2xl font-semibold text-muted-foreground">
              {tenant.name
                .split(" ")
                .map((n: string) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              {tenant.name}
            </h1>
            {tenant.tagline ? (
              <p className="mt-2 text-lg text-muted-foreground">
                {tenant.tagline}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {tenant.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {tenant.location}
                </span>
              ) : null}
              {tenant.team_size ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {tenant.team_size}
                </span>
              ) : null}
              {tenant.founded_year ? (
                <span>Etablert {tenant.founded_year}</span>
              ) : null}
              {tenant.type === "solo_consultant" ? (
                <Badge variant="outline">Uavhengig konsulent</Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild variant="brand">
              <Link href="/registrer?rolle=kunde">Send forespørsel</Link>
            </Button>
            {tenant.website ? (
              <Button asChild variant="outline" size="sm">
                <a
                  href={tenant.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Nettside <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Badge key={c.slug} variant="secondary">
                {c.name}
              </Badge>
            ))}
          </div>
        ) : null}

        {tenant.description ? (
          <Card>
            <CardHeader>
              <CardTitle>Om oss</CardTitle>
            </CardHeader>
            <CardContent>
              <Markdown>{tenant.description}</Markdown>
            </CardContent>
          </Card>
        ) : null}

        {caseStudies.length > 0 ? (
          <section>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight">
              Referanseprosjekter
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {caseStudies.map((cs) => (
                <Card key={cs.id} className="overflow-hidden">
                  {cs.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cs.cover_image_url}
                      alt=""
                      className="h-40 w-full object-cover"
                    />
                  ) : null}
                  <CardHeader>
                    <CardTitle className="text-base">{cs.title}</CardTitle>
                    {cs.client_name ? (
                      <p className="text-xs text-muted-foreground">
                        Kunde: {cs.client_name}
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    {cs.description ? <p>{cs.description}</p> : null}
                    {cs.result ? (
                      <div className="rounded-md border border-brand/30 bg-brand/5 p-3 text-xs">
                        <div className="font-medium text-foreground">
                          Resultat
                        </div>
                        <div className="mt-1">{cs.result}</div>
                      </div>
                    ) : null}
                    {cs.project_url ? (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={cs.project_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Se prosjekt <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {consultants.length > 0 ? (
          <section>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight">
              Team
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {consultants.map((c) => (
                <Link
                  key={c.id}
                  href={`/konsulenter/${c.slug}`}
                  className="group flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:border-foreground/30"
                >
                  {c.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.avatar_url}
                      alt={c.full_name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-xs font-medium text-muted-foreground">
                      {c.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {c.full_name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.title ?? "Konsulent"}
                    </div>
                    {c.hourly_rate_nok ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatCurrencyNOK(c.hourly_rate_nok)}/time
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <Card className="border-brand/40 bg-brand/5">
          <CardHeader>
            <CardTitle>Trenger du det {tenant.name} leverer?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="brand">
              <Link href="/registrer?rolle=kunde">Send forespørsel</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/konsulenter">Se alle konsulenter</Link>
            </Button>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Innovena</span>
          <Link href={`/api/public/tenants/${tenant.slug}`} className="font-mono text-xs">
            /api/public/tenants/{tenant.slug}
          </Link>
        </div>
      </footer>
    </div>
  );
}
