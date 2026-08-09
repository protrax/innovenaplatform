import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { SubscriptionStatus } from "@/lib/supabase/types";
import { AlertTriangle, Building2, CircleSlash, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

/** Listeprisene byråene faktisk betaler. Endres prisen i Stripe må disse følge med. */
const PRICE_PRO_NOK = 2990;
const PRICE_ELITE_NOK = 6990;

type Tier = "elite" | "pro" | "unknown";

const TIER_LABELS: Record<Tier, string> = {
  elite: "Elite",
  pro: "Pro Leads",
  unknown: "Ukjent nivå",
};

const TIER_PRICES: Record<Tier, number> = {
  elite: PRICE_ELITE_NOK,
  pro: PRICE_PRO_NOK,
  unknown: 0,
};

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Prøveperiode",
  active: "Aktiv",
  past_due: "Betaling feilet",
  canceled: "Avsluttet",
  incomplete: "Ikke fullført",
};

type BadgeVariant = "brand" | "destructive" | "secondary" | "outline";

const STATUS_VARIANTS: Record<SubscriptionStatus, BadgeVariant> = {
  trialing: "secondary",
  active: "brand",
  past_due: "destructive",
  canceled: "outline",
  incomplete: "outline",
};

interface SubscriptionRow {
  id: string;
  tenant_id: string;
  stripe_price_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  type: string;
  created_at: string;
}

function nok(amount: number) {
  return `${amount.toLocaleString("nb-NO")} kr`;
}

/**
 * Nivået avgjøres av price-ID-en fra Stripe, på samme måte som i
 * lead-distribution. Mangler price-ID-ene i miljøet kan vi ikke vite hvilket
 * nivå raden hører til — da sier vi «ukjent» heller enn å gjette på inntekt.
 */
function resolveTier(priceId: string | null): Tier {
  const elite = serverEnv.STRIPE_PRICE_ELITE_SUBSCRIPTION;
  const pro = serverEnv.STRIPE_PRICE_AGENCY_SUBSCRIPTION;
  if (elite && priceId === elite) return "elite";
  if (pro && priceId === pro) return "pro";
  return "unknown";
}

/**
 * Det som krever handling skal stå øverst: mislykket betaling først, deretter
 * de som har sagt opp og løper ut, så de aktive, og til slutt det som er
 * historikk.
 */
function actionRank(sub: SubscriptionRow): number {
  if (sub.status === "past_due") return 0;
  if (sub.cancel_at_period_end && sub.status !== "canceled") return 1;
  if (sub.status === "active" || sub.status === "trialing") return 2;
  if (sub.status === "incomplete") return 3;
  return 4;
}

export default async function AdminAbonnementerPage() {
  const supabase = await createClient();

  const [subsRes, tenantsRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "id, tenant_id, stripe_price_id, status, current_period_end, cancel_at_period_end, created_at",
      ),
    supabase.from("tenants").select("id, name, slug, status, type, created_at"),
  ]);

  const subscriptions = (subsRes.data ?? []) as SubscriptionRow[];
  const tenants = (tenantsRes.data ?? []) as TenantRow[];
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  const rows = subscriptions
    .map((s) => ({
      ...s,
      tier: resolveTier(s.stripe_price_id),
      tenant: tenantById.get(s.tenant_id) ?? null,
    }))
    .sort((a, b) => {
      const rank = actionRank(a) - actionRank(b);
      if (rank !== 0) return rank;
      const aEnd = a.current_period_end
        ? Date.parse(a.current_period_end)
        : Number.MAX_SAFE_INTEGER;
      const bEnd = b.current_period_end
        ? Date.parse(b.current_period_end)
        : Number.MAX_SAFE_INTEGER;
      if (aEnd !== bEnd) return aEnd - bEnd;
      return (a.tenant?.name ?? "").localeCompare(b.tenant?.name ?? "", "nb-NO");
    });

  // Betalende = abonnement som løper og gir inntekt nå. Prøveperiode betaler
  // ikke ennå, og past_due har ikke gjort opp — begge holdes utenfor MRR.
  const paying = rows.filter((r) => r.status === "active");
  const proCount = paying.filter((r) => r.tier === "pro").length;
  const eliteCount = paying.filter((r) => r.tier === "elite").length;
  const unknownTierCount = paying.filter((r) => r.tier === "unknown").length;
  const mrr = proCount * PRICE_PRO_NOK + eliteCount * PRICE_ELITE_NOK;

  const cancelling = rows.filter(
    (r) => r.cancel_at_period_end && r.status !== "canceled",
  );
  const pastDue = rows.filter((r) => r.status === "past_due");

  const subscribedTenantIds = new Set(subscriptions.map((s) => s.tenant_id));
  const freeTierTenants = tenants
    .filter((t) => t.status === "active" && !subscribedTenantIds.has(t.id))
    .sort((a, b) => a.name.localeCompare(b.name, "nb-NO"));

  const pricesConfigured = Boolean(
    serverEnv.STRIPE_PRICE_ELITE_SUBSCRIPTION &&
      serverEnv.STRIPE_PRICE_AGENCY_SUBSCRIPTION,
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Abonnementer</h2>
        <p className="text-sm text-muted-foreground">
          Hvem som betaler, hva de betaler for, og hvem som står i fare for å
          falle fra. Pro Leads {nok(PRICE_PRO_NOK)}/mnd · Elite{" "}
          {nok(PRICE_ELITE_NOK)}/mnd.
        </p>
      </div>

      {subscriptions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen abonnementer ennå</CardTitle>
            <CardDescription>
              Ingen byråer har tegnet abonnement. Alle {freeTierTenants.length}{" "}
              aktive byråer står på gratisnivå.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Så snart det første byrået betaler, viser denne siden:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                Antall betalende fordelt på Pro Leads og Elite, og estimert MRR.
              </li>
              <li>
                Hvem som har sagt opp og hvilken dato abonnementet løper ut.
              </li>
              <li>
                Hvem som har mislykket betaling og må følges opp med en gang.
              </li>
            </ul>
            <p>
              Abonnementer opprettes når et byrå går gjennom Stripe-checkouten
              på <span className="font-medium">/byraa/abonnement</span>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Nøkkeltall
            </h3>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                icon={<Wallet className="h-4 w-4" />}
                label="Estimert MRR"
                value={nok(mrr)}
                hint={`${proCount} Pro Leads · ${eliteCount} Elite`}
              />
              <MetricCard
                icon={<Building2 className="h-4 w-4" />}
                label="Betalende byråer"
                value={String(proCount + eliteCount)}
                hint={
                  unknownTierCount > 0
                    ? `${unknownTierCount} aktive uten kjent prisnivå`
                    : "Aktive abonnement"
                }
                highlight={unknownTierCount > 0}
              />
              <MetricCard
                icon={<CircleSlash className="h-4 w-4" />}
                label="I oppsigelse"
                value={String(cancelling.length)}
                hint={
                  cancelling.length > 0
                    ? "Løper ut ved periodeslutt"
                    : "Ingen har sagt opp"
                }
                highlight={cancelling.length > 0}
              />
              <MetricCard
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Betaling feilet"
                value={String(pastDue.length)}
                hint={
                  pastDue.length > 0 ? "Krever handling" : "Ingen betalingsfeil"
                }
                highlight={pastDue.length > 0}
              />
            </div>
          </section>

          {!pricesConfigured || unknownTierCount > 0 ? (
            <Card className="border-yellow-500/50 bg-yellow-500/5">
              <CardHeader>
                <CardTitle className="text-base">
                  Prisnivå kan ikke avgjøres for alle abonnement
                </CardTitle>
                <CardDescription>
                  Nivået leses av price-ID-en fra Stripe mot
                  STRIPE_PRICE_ELITE_SUBSCRIPTION og
                  STRIPE_PRICE_AGENCY_SUBSCRIPTION. Rader merket «Ukjent nivå»
                  telles ikke med i MRR.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <section>
            <Card>
              <CardHeader>
                <CardTitle>
                  Alle abonnement ({subscriptions.length})
                </CardTitle>
                <CardDescription>
                  Betalingsfeil og oppsigelser står øverst — det er de som
                  krever handling.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Byrå</th>
                        <th className="pb-2 pr-4 font-medium">Nivå</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium">
                          Fornyes / utløper
                        </th>
                        <th className="pb-2 font-medium">Merknad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((r) => {
                        const isCancelling =
                          r.cancel_at_period_end && r.status !== "canceled";
                        return (
                          <tr
                            key={r.id}
                            className={
                              r.status === "past_due"
                                ? "bg-destructive/5"
                                : isCancelling
                                  ? "bg-yellow-500/5"
                                  : undefined
                            }
                          >
                            <td className="py-3 pr-4">
                              <Link
                                href="/admin/byraaer"
                                className="font-medium underline-offset-2 hover:underline"
                              >
                                {r.tenant?.name ?? "Ukjent byrå"}
                              </Link>
                              {r.tenant ? (
                                <div className="text-xs text-muted-foreground">
                                  {r.tenant.slug}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-3 pr-4">
                              <div>{TIER_LABELS[r.tier]}</div>
                              {r.tier === "unknown" ? null : (
                                <div className="text-xs tabular-nums text-muted-foreground">
                                  {nok(TIER_PRICES[r.tier])}/mnd
                                </div>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              <Badge variant={STATUS_VARIANTS[r.status]}>
                                {STATUS_LABELS[r.status] ?? r.status}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4 tabular-nums">
                              {r.current_period_end
                                ? formatDate(r.current_period_end)
                                : "—"}
                            </td>
                            <td className="py-3">
                              {isCancelling ? (
                                <Badge variant="destructive">
                                  Sagt opp — løper ut
                                </Badge>
                              ) : r.status === "past_due" ? (
                                <Badge variant="destructive">
                                  Følg opp betaling
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}

      <section>
        <Card className="border-dashed bg-muted/20">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base text-muted-foreground">
                  På gratisnivå ({freeTierTenants.length})
                </CardTitle>
                <CardDescription>
                  Aktive byråer uten abonnement. De får maks to plasser på leads
                  der noen betaler — dette er oppsalgslisten.
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/byraaer">Alle byråer</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {freeTierTenants.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Ingen aktive byråer uten abonnement.
              </p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {freeTierTenants.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <Link
                      href="/admin/byraaer"
                      className="font-medium text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {t.name}
                    </Link>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      registrert {formatDate(t.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
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
        <CardDescription className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{icon}</span>
          {label}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
