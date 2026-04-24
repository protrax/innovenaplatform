import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { formatCurrencyNOK } from "@/lib/utils";
import { ExternalLink, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ConsultantProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Use admin client so this page works without auth
  const admin = createAdminClient();
  const { data: consultant } = await admin
    .from("consultant_profiles")
    .select(
      `id, slug, full_name, title, headline, bio, avatar_url,
       hourly_rate_nok, years_experience, available_from,
       available_hours_per_week, location, languages, linkedin_url,
       portfolio_url, visible_in_marketplace,
       tenant:tenants!inner(id, name, slug, type, status, description, website),
       skills:consultant_skills(category_id, skill_name, service_categories(slug, name))`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!consultant || !consultant.visible_in_marketplace) notFound();
  const tenant = consultant.tenant as unknown as {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
    description: string | null;
    website: string | null;
  };
  if (tenant.status !== "active") notFound();

  const skills =
    (consultant.skills as unknown as Array<{
      category_id: string | null;
      skill_name: string | null;
      service_categories: { slug: string; name: string } | null;
    }>) ?? [];

  const categoryTags = skills
    .filter((s) => s.service_categories)
    .map((s) => s.service_categories!);
  const freeformSkills = skills
    .filter((s) => s.skill_name)
    .map((s) => s.skill_name!);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-6 w-6 rounded-md bg-brand" aria-hidden />
            <span>Innovena Platform</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/konsulenter">← Tilbake til markedsplass</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {consultant.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={consultant.avatar_url}
              alt={consultant.full_name}
              className="h-28 w-28 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-muted-foreground">
              {consultant.full_name
                .split(" ")
                .map((n: string) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              {consultant.full_name}
            </h1>
            {consultant.title ? (
              <p className="text-lg text-muted-foreground">{consultant.title}</p>
            ) : null}
            {consultant.headline ? (
              <p className="mt-2 text-base">{consultant.headline}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {consultant.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {consultant.location}
                </span>
              ) : null}
              {consultant.years_experience ? (
                <span>· {consultant.years_experience} års erfaring</span>
              ) : null}
              {tenant.type === "solo_consultant" ? (
                <Badge variant="outline">Uavhengig konsulent</Badge>
              ) : (
                <span>
                  · Jobber hos{" "}
                  <Link
                    href={`/byraaer/${tenant.slug}`}
                    className="text-brand underline-offset-2 hover:underline"
                  >
                    {tenant.name}
                  </Link>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <KeyFact
            label="Timepris"
            value={
              consultant.hourly_rate_nok
                ? formatCurrencyNOK(consultant.hourly_rate_nok)
                : "Kontakt"
            }
            hint="eks. mva"
          />
          <KeyFact
            label="Tilgjengelig"
            value={
              consultant.available_from
                ? new Date(consultant.available_from).toLocaleDateString("nb-NO")
                : "Kontakt for avtale"
            }
            hint={
              consultant.available_hours_per_week
                ? `${consultant.available_hours_per_week}t / uke`
                : ""
            }
          />
          <KeyFact
            label="Språk"
            value={
              consultant.languages?.length ? consultant.languages.join(", ") : "—"
            }
          />
        </div>

        {consultant.bio ? (
          <Card>
            <CardHeader>
              <CardTitle>Om meg</CardTitle>
            </CardHeader>
            <CardContent>
              <Markdown>{consultant.bio}</Markdown>
            </CardContent>
          </Card>
        ) : null}

        {categoryTags.length > 0 || freeformSkills.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Ferdigheter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryTags.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Kategorier
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categoryTags.map((c) => (
                      <Badge key={c.slug} variant="brand">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {freeformSkills.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Spesifikke ferdigheter
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {freeformSkills.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-border bg-card px-3 py-1 text-sm"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {(consultant.linkedin_url || consultant.portfolio_url) && (
          <Card>
            <CardHeader>
              <CardTitle>Lenker</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {consultant.linkedin_url ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={consultant.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              ) : null}
              {consultant.portfolio_url ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={consultant.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Portefølje <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}

        <Card className="border-brand/40 bg-brand/5">
          <CardHeader>
            <CardTitle>Vil du booke {consultant.full_name.split(" ")[0]}?</CardTitle>
            <CardDescription>
              Send en forespørsel gjennom Innovena. Ingen bindende kostnad før
              dere har avtalt omfang.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="brand">
              <Link href="/registrer?rolle=kunde">Send forespørsel</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/logg-inn">Logg inn</Link>
            </Button>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Innovena</span>
          <Link href="/konsulenter">Alle konsulenter</Link>
        </div>
      </footer>
    </div>
  );
}

function KeyFact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint ? (
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
