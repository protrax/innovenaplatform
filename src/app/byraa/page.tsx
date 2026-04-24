import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAgencyStats } from "@/lib/analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyNOK, formatDate } from "@/lib/utils";
import {
  Clock,
  FileText,
  Inbox,
  MessageSquare,
  Percent,
  TrendingUp,
  Wallet,
} from "lucide-react";

export default async function ByraaOversikt() {
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  const supabase = await createClient();

  const { data: tenant } = tenantId
    ? await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle()
    : { data: null };

  const pendingApproval = tenant?.status === "pending_approval";
  const stats = tenantId
    ? await fetchAgencyStats({ tenantId, userId: user.id })
    : null;

  const leadsRes = tenantId
    ? await supabase
        .from("project_leads")
        .select(
          "id, distributed_at, viewed_at, projects!inner(id, title, status)",
        )
        .eq("tenant_id", tenantId)
        .order("distributed_at", { ascending: false })
        .limit(5)
    : { data: null };
  const leads = leadsRes.data ?? [];

  // Check if tenant has any categories configured — without them they'll
  // never match incoming leads from innovena.no.
  const { data: tenantCats } = tenantId
    ? await supabase
        .from("tenant_categories")
        .select("category_id")
        .eq("tenant_id", tenantId)
    : { data: [] };
  const hasCategories = (tenantCats ?? []).length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">
          Hei {user.fullName?.split(" ")[0] ?? ""} 👋
        </h2>
        <p className="text-sm text-muted-foreground">
          {pendingApproval
            ? "Venter på godkjenning — forbered kontoen i mellomtiden."
            : stats?.subscription_status !== "active"
              ? "Aktiver abonnementet for å begynne å motta leads."
              : "Oversikt over leads, tilbud og omsetning."}
        </p>
      </div>

      {!hasCategories && !pendingApproval ? (
        <Card className="border-[#ff7849]/50 bg-[#ff7849]/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              ⚠️ Du får ingen leads før kategorier er valgt
            </CardTitle>
            <CardDescription>
              Vi matcher leads mot byråer som har valgt de tjenestekategoriene
              leadet gjelder. Velg kategoriene dere tilbyr — det tar 30 sekunder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="brand" size="sm">
              <Link href="/byraa/innstillinger#kategorier">
                Velg kategorier nå
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {pendingApproval ? (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-base">⏳ Venter på godkjenning</CardTitle>
            <CardDescription>
              Innovena gjennomgår ditt byrå — vanligvis ferdig innen 24 timer.
              Du får e-post så snart dere er godkjent. I mellomtiden, forbered
              kontoen:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-brand">1.</span>
                <Link
                  href="/byraa/innstillinger"
                  className="text-brand underline-offset-2 hover:underline"
                >
                  Velg kategoriene du tilbyr
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-brand">2.</span>
                <Link
                  href="/byraa/profil"
                  className="text-brand underline-offset-2 hover:underline"
                >
                  Fyll ut offentlig profil med logo + case studies
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-brand">3.</span>
                <Link
                  href="/byraa/konsulenter"
                  className="text-brand underline-offset-2 hover:underline"
                >
                  Legg inn konsulenter
                </Link>
              </li>
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {!pendingApproval &&
      stats &&
      (stats.subscription_status !== "active" ||
        stats.subscription_status === null) ? (
        <Card className="border-brand/40 bg-gradient-to-br from-brand/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-base">🚀 Lås opp leads</CardTitle>
            <CardDescription>
              Dere er godkjent. Start abonnement for 990 kr/mnd så begynner
              leads å tikke inn i pipelinen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="brand" size="sm">
              <Link href="/byraa/abonnement">Start abonnement</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {stats ? (
        <>
          {/* Performance cards */}
          <section>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Denne måneden
            </h3>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                icon={<Inbox className="h-4 w-4" />}
                label="Leads mottatt"
                value={String(stats.leads_this_month)}
                hint={`${stats.leads_lifetime} totalt`}
              />
              <MetricCard
                icon={<FileText className="h-4 w-4" />}
                label="Tilbud sendt"
                value={String(stats.bids_sent_this_month)}
              />
              <MetricCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Vunnet"
                value={String(stats.wins_this_month)}
                hint={
                  stats.wins_this_month_value_nok > 0
                    ? formatCurrencyNOK(stats.wins_this_month_value_nok)
                    : undefined
                }
              />
              <MetricCard
                icon={<Wallet className="h-4 w-4" />}
                label="Omsetning"
                value={formatCurrencyNOK(stats.revenue_this_month_nok)}
                hint="Innbetalte fakturaer"
              />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Nøkkeltall
            </h3>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                icon={<Percent className="h-4 w-4" />}
                label="Win-rate"
                value={`${stats.win_rate_pct}%`}
                hint="Akseptert av kunder"
              />
              <MetricCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Pipeline-verdi"
                value={formatCurrencyNOK(stats.bids_open_value_nok)}
                hint={`${stats.bids_open} aktive tilbud`}
              />
              <MetricCard
                icon={<Clock className="h-4 w-4" />}
                label="Gj.snitt svartid"
                value={
                  stats.avg_response_hours !== null
                    ? `${stats.avg_response_hours}t`
                    : "—"
                }
                hint="Fra lead til tilbud"
              />
              <MetricCard
                icon={<MessageSquare className="h-4 w-4" />}
                label="Uleste meldinger"
                value={String(stats.unread_messages)}
                hint={
                  stats.unread_messages > 0 ? "Gå til meldinger" : undefined
                }
                highlight={stats.unread_messages > 0}
                href={
                  stats.unread_messages > 0 ? "/byraa/meldinger" : undefined
                }
              />
            </div>
          </section>

          {stats.invoices_outstanding_count > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Utestående fakturaer</CardTitle>
                    <CardDescription>
                      {stats.invoices_outstanding_count} fakturaer venter på
                      betaling
                    </CardDescription>
                  </div>
                  <div className="text-2xl font-semibold">
                    {formatCurrencyNOK(stats.invoices_outstanding_value_nok)}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ) : null}
        </>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Siste leads</CardTitle>
              <CardDescription>Forespørsler distribuert til deg.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/byraa/leads">Alle leads</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">Ingen leads ennå</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pendingApproval
                  ? "Så snart dere er godkjent, får dere matchende forespørsler her."
                  : stats?.subscription_status !== "active"
                    ? "Aktiver abonnementet for å begynne å motta leads."
                    : "Sjekk at dere har lagt til riktige kategorier under Innstillinger."}
              </p>
              {!pendingApproval ? (
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href="/byraa/innstillinger">Sjekk kategorier</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {leads.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    {/* @ts-expect-error — joined */}
                    <div className="font-medium">{l.projects.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Mottatt {formatDate(l.distributed_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!l.viewed_at ? <Badge variant="brand">Ny</Badge> : null}
                    <Button asChild variant="ghost" size="sm">
                      {/* @ts-expect-error — joined */}
                      <Link href={`/byraa/leads/${l.projects.id}`}>Åpne</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  highlight,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
  href?: string;
}) {
  const inner = (
    <Card
      className={
        highlight
          ? "border-brand/40 bg-brand/5 transition-colors hover:bg-brand/10"
          : href
            ? "transition-colors hover:border-foreground/30"
            : ""
      }
    >
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{icon}</span>
          {label}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}
