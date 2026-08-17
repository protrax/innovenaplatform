import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TenantStatusActions } from "./tenant-status-actions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Venter godkjenning",
  active: "Aktiv",
  suspended: "Suspendert",
  rejected: "Avslått",
};

/** Ni siffer, eventuelt med mellomrom — samme format Brønnøysund bruker. */
function orgNumberDigits(org: string | null): string | null {
  if (!org) return null;
  const digits = org.replace(/\D/g, "");
  return digits.length === 9 ? digits : null;
}

function Field({
  label,
  children,
  missing,
}: {
  label: string;
  children: React.ReactNode;
  missing?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={missing ? "text-sm text-muted-foreground" : "text-sm"}>
        {children}
      </div>
    </div>
  );
}

export default async function AdminByraaerPage() {
  const supabase = await createClient();

  const [{ data: tenants }, { data: members }, { data: tenantCats }] =
    await Promise.all([
      supabase.from("tenants").select("*").order("created_at", { ascending: false }),
      supabase
        .from("tenant_members")
        .select("tenant_id, role, profiles!inner(full_name, email, phone)"),
      supabase
        .from("tenant_categories")
        .select("tenant_id, service_categories!inner(name)"),
    ]);

  const membersByTenant = new Map<string, typeof members>();
  for (const m of members ?? []) {
    const list = membersByTenant.get(m.tenant_id) ?? [];
    list.push(m);
    membersByTenant.set(m.tenant_id, list as typeof members);
  }

  const catsByTenant = new Map<string, string[]>();
  for (const c of tenantCats ?? []) {
    // @ts-expect-error — joinet relasjon
    const name = c.service_categories?.name;
    if (!name) continue;
    catsByTenant.set(c.tenant_id, [
      ...(catsByTenant.get(c.tenant_id) ?? []),
      name,
    ]);
  }

  // De som venter på svar skal ligge øverst — det er handlingskøen.
  const sorted = [...(tenants ?? [])].sort((a, b) => {
    const aPending = a.status === "pending_approval" ? 0 : 1;
    const bPending = b.status === "pending_approval" ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return b.created_at.localeCompare(a.created_at);
  });

  const pendingCount = sorted.filter(
    (t) => t.status === "pending_approval",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Byråer &amp; konsulenter</h2>
        <p className="text-sm text-muted-foreground">
          {pendingCount > 0
            ? `${pendingCount} venter på godkjenning. Sjekk organisasjonsnummer og nettsted før du slipper noen inn.`
            : "Ingen venter på godkjenning akkurat nå."}
        </p>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen byråer registrert ennå</CardTitle>
            <CardDescription>
              Når byråer registrerer seg dukker de opp her for godkjenning.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sorted.map((t) => {
            const tenantMembers = membersByTenant.get(t.id) ?? [];
            const owner =
              tenantMembers.find((m) => m.role === "owner") ?? tenantMembers[0];
            // @ts-expect-error — joinet relasjon
            const profile = owner?.profiles as
              | { full_name: string | null; email: string; phone: string | null }
              | undefined;
            const cats = catsByTenant.get(t.id) ?? [];
            const orgDigits = orgNumberDigits(t.org_number);
            const isPending = t.status === "pending_approval";

            // Signaler på om profilen er reell eller et tomt skall.
            const filled = [
              t.org_number,
              t.website,
              t.description,
              t.location,
              t.logo_url,
            ].filter(Boolean).length;

            return (
              <Card
                key={t.id}
                className={isPending ? "border-brand/50" : undefined}
              >
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {t.name || "(uten navn)"}
                      </CardTitle>
                      <CardDescription>
                        {t.type === "solo_consultant"
                          ? "Solo-konsulent"
                          : "Byrå"}{" "}
                        · registrert {formatDate(t.created_at)} ·{" "}
                        {filled}/5 profilfelt utfylt
                      </CardDescription>
                    </div>
                    <Badge variant={t.status === "active" ? "brand" : "outline"}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Organisasjonsnummer" missing={!orgDigits}>
                      {orgDigits ? (
                        <a
                          href={`https://virksomhet.brreg.no/nb/oppslag/enheter/${orgDigits}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          {t.org_number} — slå opp i Brønnøysund ↗
                        </a>
                      ) : (
                        "Ikke oppgitt — be om det før godkjenning"
                      )}
                    </Field>

                    <Field label="Nettsted" missing={!t.website}>
                      {t.website ? (
                        <a
                          href={t.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          {t.website.replace(/^https?:\/\//, "")} ↗
                        </a>
                      ) : (
                        "Ikke oppgitt"
                      )}
                    </Field>

                    <Field label="Sted" missing={!t.location}>
                      {t.location || "Ikke oppgitt"}
                    </Field>

                    <Field label="Kontaktperson" missing={!profile}>
                      {profile ? (
                        <>
                          {profile.full_name || "(navn mangler)"}
                          <div className="text-muted-foreground">
                            <a
                              href={`mailto:${profile.email}`}
                              className="underline underline-offset-2"
                            >
                              {profile.email}
                            </a>
                            {profile.phone ? ` · ${profile.phone}` : ""}
                          </div>
                        </>
                      ) : (
                        "Ingen bruker koblet til"
                      )}
                    </Field>

                    <Field label="Etablert / størrelse" missing={!t.founded_year && !t.team_size}>
                      {[t.founded_year, t.team_size].filter(Boolean).join(" · ") ||
                        "Ikke oppgitt"}
                    </Field>

                    <Field label="Fagområder" missing={cats.length === 0}>
                      {cats.length > 0
                        ? cats.join(", ")
                        : "Ingen valgt — de får ingen forespørsler slik"}
                    </Field>
                  </div>

                  {t.tagline || t.description ? (
                    <div className="rounded-md bg-accent/40 p-3 text-sm">
                      {t.tagline ? (
                        <p className="font-medium">{t.tagline}</p>
                      ) : null}
                      {t.description ? (
                        <p className="mt-1 whitespace-pre-line text-muted-foreground">
                          {t.description.slice(0, 400)}
                          {t.description.length > 400 ? "…" : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Ingen beskrivelse fylt ut. En tom profil ser dårlig ut i
                      katalogen på innovena.no — be dem fylle den før du
                      godkjenner.
                    </p>
                  )}

                  {t.status === "active" ? (
                    <Link
                      href={`https://www.innovena.no/byraer/${t.slug}/`}
                      target="_blank"
                      className="inline-block text-xs underline underline-offset-2"
                    >
                      Se offentlig profil på innovena.no ↗
                    </Link>
                  ) : null}

                  <TenantStatusActions tenantId={t.id} currentStatus={t.status} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
