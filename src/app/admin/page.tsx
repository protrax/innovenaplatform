import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchAdminStats } from "@/lib/analytics";
import { formatCurrencyNOK } from "@/lib/utils";
import {
  Activity,
  Building2,
  CheckCircle,
  Percent,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOversikt() {
  const stats = await fetchAdminStats();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Admin-oversikt</h2>
        <p className="text-sm text-muted-foreground">
          Finansielle og operasjonelle nøkkeltall for Innovena Platform.
        </p>
      </div>

      {/* Revenue */}
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Omsetning
        </h3>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            icon={<Wallet className="h-4 w-4" />}
            label="MRR"
            value={formatCurrencyNOK(stats.mrr_nok)}
            hint={`${stats.active_subscriptions} aktive abonnement`}
          />
          <MetricCard
            icon={<Percent className="h-4 w-4" />}
            label="Plattformgebyr · denne mnd"
            value={formatCurrencyNOK(stats.fees_this_month_nok)}
            hint="2,5 % på fakturerte prosjekter"
          />
          <MetricCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Kontraktsverdi · denne mnd"
            value={formatCurrencyNOK(stats.gmv_this_month_nok)}
            hint={`${stats.contracts_this_month} signerte avtaler`}
          />
          <MetricCard
            icon={<Wallet className="h-4 w-4" />}
            label="Plattformgebyr · totalt"
            value={formatCurrencyNOK(stats.fees_lifetime_nok)}
            hint={`GMV ${formatCurrencyNOK(stats.gmv_lifetime_nok)}`}
          />
        </div>
      </section>

      {/* Activity */}
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Aktivitet · denne måneden
        </h3>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            icon={<Activity className="h-4 w-4" />}
            label="Nye leads"
            value={String(stats.leads_this_month)}
            hint={`${stats.leads_lifetime} totalt`}
          />
          <MetricCard
            icon={<Activity className="h-4 w-4" />}
            label="Nye tilbud"
            value={String(stats.new_bids_this_month)}
          />
          <MetricCard
            icon={<Percent className="h-4 w-4" />}
            label="Match-rate"
            value={`${stats.match_rate_pct}%`}
            hint="Prosjekter som fikk minst ett tilbud"
          />
          <MetricCard
            icon={<CheckCircle className="h-4 w-4" />}
            label="Win-rate"
            value={`${stats.win_rate_pct}%`}
            hint="Akseptert av kunder"
          />
        </div>
      </section>

      {/* Base */}
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Brukerbase
        </h3>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            icon={<Building2 className="h-4 w-4" />}
            label="Aktive byråer"
            value={String(stats.tenants_active)}
          />
          <MetricCard
            icon={<Building2 className="h-4 w-4" />}
            label="Venter godkjenning"
            value={String(stats.tenants_pending)}
            hint={
              stats.tenants_pending > 0 ? "Krever handling" : "Alt godkjent"
            }
            highlight={stats.tenants_pending > 0}
          />
          <MetricCard
            icon={<Building2 className="h-4 w-4" />}
            label="Suspenderte"
            value={String(stats.tenants_suspended)}
          />
          <MetricCard
            icon={<Users className="h-4 w-4" />}
            label="Kunder totalt"
            value={String(stats.customers_lifetime)}
          />
        </div>
      </section>

      {/* Monthly trend */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>6-måneders trend</CardTitle>
            <CardDescription>Leads inn, kontrakter signert, omsetning.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyTrendTable data={stats.monthly_trend} />
          </CardContent>
        </Card>
      </section>

      {/* Top agencies */}
      <section>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Topp byråer — etter kontraktsverdi</CardTitle>
                <CardDescription>
                  Alle signerte kontrakter, sortert etter verdi.
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/byraaer">Alle byråer</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.top_agencies.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Ingen signerte kontrakter ennå.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {stats.top_agencies.map((a, i) => (
                  <li
                    key={a.tenant_id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <div>
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.wins} {a.wins === 1 ? "avtale" : "avtaler"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-semibold">
                      {formatCurrencyNOK(a.total_value_nok)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick actions */}
      {stats.tenants_pending > 0 ? (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-base">
              {stats.tenants_pending}{" "}
              {stats.tenants_pending === 1
                ? "byrå venter"
                : "byråer venter"}{" "}
              på godkjenning
            </CardTitle>
            <CardDescription>
              Godkjenn dem raskt så kan de begynne å motta leads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="brand" size="sm">
              <Link href="/admin/byraaer">Gjennomgå nå</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-yellow-500/50 bg-yellow-500/5" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{icon}</span>
            {label}
          </CardDescription>
        </div>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

function MonthlyTrendTable({
  data,
}: {
  data: Array<{
    month: string;
    leads: number;
    contracts: number;
    value_nok: number;
  }>;
}) {
  const maxLeads = Math.max(1, ...data.map((d) => d.leads));
  const maxContracts = Math.max(1, ...data.map((d) => d.contracts));
  return (
    <div className="space-y-3">
      {data.map((row) => (
        <div
          key={row.month}
          className="grid grid-cols-[80px_1fr_100px] items-center gap-3 text-sm"
        >
          <div className="font-mono text-xs text-muted-foreground">
            {row.month}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-accent">
                <div
                  className="absolute inset-y-0 left-0 bg-brand/70"
                  style={{ width: `${(row.leads / maxLeads) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right font-medium">{row.leads}</span>
              <span className="w-12 text-right text-xs text-muted-foreground">leads</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-accent">
                <div
                  className="absolute inset-y-0 left-0 bg-brand"
                  style={{ width: `${(row.contracts / maxContracts) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right font-medium">
                {row.contracts}
              </span>
              <span className="w-12 text-right text-xs text-muted-foreground">
                avtaler
              </span>
            </div>
          </div>
          <div className="text-right font-medium">
            {row.value_nok > 0 ? formatCurrencyNOK(row.value_nok) : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}
