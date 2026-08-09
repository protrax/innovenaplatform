import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Dekningsanalyse: hvilke kategorier har etterspørsel, men ingen byråer å
 * levere den til?
 *
 * Dette er rekrutteringslista. Kommer det forespørsler om apputvikling og vi
 * har null aktive byråer der, taper vi den inntekten hver gang — og det står
 * ingen andre steder i portalen.
 */
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  requests: number;
  agencies: number;
  freeAgencies: number;
};

function gapLabel(r: Row) {
  if (r.agencies === 0 && r.requests > 0)
    return { text: "Ingen dekning", variant: "destructive" as const };
  if (r.agencies === 0)
    return { text: "Ingen byrå", variant: "outline" as const };
  if (r.requests > 0 && r.agencies < 3)
    return { text: "Tynn dekning", variant: "brand" as const };
  return { text: "Dekket", variant: "outline" as const };
}

export default async function AdminDekningPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: projectCats }, { data: tenantCats }] =
    await Promise.all([
      supabase
        .from("service_categories")
        .select("id, name, slug, active, sort_order")
        .order("sort_order"),
      supabase.from("project_categories").select("category_id"),
      supabase
        .from("tenant_categories")
        .select("category_id, tenant_id, tenants!inner(status)"),
    ]);

  const requestCount = new Map<string, number>();
  for (const pc of projectCats ?? []) {
    requestCount.set(
      pc.category_id,
      (requestCount.get(pc.category_id) ?? 0) + 1,
    );
  }

  const agencyCount = new Map<string, number>();
  for (const tc of tenantCats ?? []) {
    // @ts-expect-error — joinet relasjon
    if (tc.tenants?.status !== "active") continue;
    agencyCount.set(tc.category_id, (agencyCount.get(tc.category_id) ?? 0) + 1);
  }

  const rows: Row[] = (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    active: c.active,
    requests: requestCount.get(c.id) ?? 0,
    agencies: agencyCount.get(c.id) ?? 0,
    freeAgencies: 0,
  }));

  // Sorter etter hvor mye det haster: etterspørsel uten dekning først.
  const ranked = [...rows].sort((a, b) => {
    const aGap = a.requests > 0 && a.agencies === 0 ? 1 : 0;
    const bGap = b.requests > 0 && b.agencies === 0 ? 1 : 0;
    if (aGap !== bGap) return bGap - aGap;
    if (b.requests !== a.requests) return b.requests - a.requests;
    return a.agencies - b.agencies;
  });

  const critical = ranked.filter((r) => r.requests > 0 && r.agencies === 0);
  const thin = ranked.filter(
    (r) => r.requests > 0 && r.agencies > 0 && r.agencies < 3,
  );
  const uncovered = ranked.filter((r) => r.requests === 0 && r.agencies === 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Dekning</h2>
        <p className="text-sm text-muted-foreground">
          Hvor etterspørselen er, og om vi har byråer til å ta den. Øverste rad
          er rekrutteringslista di.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Etterspørsel uten dekning</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {critical.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Kategorier med forespørsler og null aktive byrå
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tynn dekning</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {thin.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Færre enn tre byrå — kunden får ikke reell sammenligning
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Uten byrå i det hele tatt</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {uncovered.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Ingen etterspørsel ennå, men heller ingen å levere med
          </CardContent>
        </Card>
      </div>

      {critical.length > 0 ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">
              Her taper vi penger nå
            </CardTitle>
            <CardDescription>
              Det har kommet forespørsler i disse kategoriene, men ingen aktive
              byrå å sende dem til. Hver ny forespørsel her går i vasken.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {critical.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
              >
                <span className="font-medium">{r.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {r.requests} forespørsel{r.requests === 1 ? "" : "er"} · 0 byrå
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Alle kategorier</CardTitle>
          <CardDescription>
            Sortert etter hvor mye det haster. «Forespørsler» teller alle som
            noen gang er sendt inn i kategorien.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium">Kategori</th>
                  <th className="pb-2 text-right font-medium">Forespørsler</th>
                  <th className="pb-2 text-right font-medium">Aktive byrå</th>
                  <th className="pb-2 pl-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => {
                  const label = gapLabel(r);
                  return (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2">
                        {r.name}
                        {!r.active ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (deaktivert)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {r.requests}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {r.agencies}
                      </td>
                      <td className="py-2 pl-4">
                        <Badge variant={label.variant}>{label.text}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
