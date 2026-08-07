import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Utkast",
  published: "Publisert",
  in_progress: "Pågår",
  completed: "Fullført",
  closed: "Lukket",
};

function formatBudget(min: number | null, max: number | null) {
  const fmt = (n: number) => `${n.toLocaleString("nb-NO")} kr`;
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  if (min) return `fra ${fmt(min)}`;
  if (max) return `inntil ${fmt(max)}`;
  return "Ikke oppgitt";
}

export default async function AdminLeadsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select(
      `id, title, description, budget_min_nok, budget_max_nok, status, source,
       location, created_at,
       customer:profiles!projects_customer_id_fkey(full_name, email, phone),
       project_categories(category:service_categories(name)),
       project_leads(distributed_at, viewed_at, dismissed_at,
         tenant:tenants(name))`,
    )
    .order("created_at", { ascending: false })
    .limit(300);

  const total = projects?.length ?? 0;
  const distributed =
    projects?.filter((p) => (p.project_leads?.length ?? 0) > 0).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Alle leads</h2>
        <p className="text-sm text-muted-foreground">
          Hver forespørsel som noen gang er sendt inn — {total} totalt,{" "}
          {distributed} distribuert til byråer.
        </p>
      </div>

      {!projects || projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen leads ennå</CardTitle>
            <CardDescription>
              Forespørsler fra AI-wizarden og innovena.no dukker opp her.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => {
            const customer = Array.isArray(p.customer)
              ? p.customer[0]
              : p.customer;
            const cats = (p.project_categories ?? [])
              .map((c) => {
                const cat = Array.isArray(c.category)
                  ? c.category[0]
                  : c.category;
                return cat?.name;
              })
              .filter(Boolean);
            const leads = p.project_leads ?? [];
            return (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{p.title}</CardTitle>
                      <CardDescription>
                        {formatDate(p.created_at)} ·{" "}
                        {p.source === "innovena_site"
                          ? "via innovena.no"
                          : "direkte i plattformen"}
                        {p.location ? ` · ${p.location}` : ""}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                      <Badge variant={leads.length > 0 ? "brand" : "outline"}>
                        {leads.length > 0
                          ? `${leads.length} byrå${leads.length === 1 ? "" : "er"}`
                          : "Ikke distribuert"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="line-clamp-3 whitespace-pre-line text-muted-foreground">
                    {p.description}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Kunde
                      </div>
                      <div>{customer?.full_name ?? "—"}</div>
                      <div className="text-muted-foreground">
                        {customer?.email ?? "—"}
                        {customer?.phone ? ` · ${customer.phone}` : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Budsjett
                      </div>
                      <div>{formatBudget(p.budget_min_nok, p.budget_max_nok)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Kategorier
                      </div>
                      <div>{cats.length ? cats.join(", ") : "—"}</div>
                    </div>
                  </div>
                  {leads.length > 0 ? (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Distribuert til
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {leads.map((l, i) => {
                          const tenant = Array.isArray(l.tenant)
                            ? l.tenant[0]
                            : l.tenant;
                          return (
                            <Badge key={i} variant="outline">
                              {tenant?.name ?? "Ukjent"}
                              {l.dismissed_at
                                ? " · avslått"
                                : l.viewed_at
                                  ? " · sett"
                                  : " · ikke sett"}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
