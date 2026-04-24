import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCurrencyNOK, formatDate } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Inbox,
  Plus,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";

export default async function KundeOversikt() {
  const user = await requireUser();
  const supabase = await createClient();

  const [projectsRes, bidsRes, invoicesRes, contractsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, status, created_at, budget_min_nok, budget_max_nok")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("bids")
      .select(
        "id, status, project_id, amount_nok, delivery_weeks, summary, created_at, tenants!inner(name), projects!inner(customer_id, title)",
      )
      .eq("projects.customer_id", user.id)
      .in("status", ["sent", "viewed"])
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("invoices")
      .select("id, total_nok, status, customer_id")
      .eq("customer_id", user.id)
      .in("status", ["sent", "overdue"]),
    supabase
      .from("contracts")
      .select("id, status, customer_id")
      .eq("customer_id", user.id)
      .eq("status", "signed"),
  ]);

  const projects = projectsRes.data ?? [];
  const bids = bidsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const signedContracts = contractsRes.data ?? [];

  const activeProjects = projects.filter(
    (p) => p.status !== "completed" && p.status !== "cancelled",
  ).length;
  const newBids = bids.filter((b) => b.status === "sent").length;
  const invoicesDueCount = invoices.length;
  const invoicesDueTotal = invoices.reduce(
    (sum, inv) => sum + (inv.total_nok ?? 0),
    0,
  );

  // Progress on the most recently active project (if any)
  const activeProject = projects.find(
    (p) => p.status !== "completed" && p.status !== "cancelled",
  );
  let progress: {
    title: string;
    id: string;
    total: number;
    done: number;
    pct: number;
    nextTask: string | null;
    nextDue: string | null;
  } | null = null;
  if (activeProject) {
    const { data: tasks } = await supabase
      .from("project_tasks")
      .select("title, status, visibility, due_date")
      .eq("project_id", activeProject.id)
      .neq("status", "cancelled");
    const visible = (tasks ?? []).filter((t) => t.visibility !== "internal");
    const done = visible.filter((t) => t.status === "done").length;
    const total = visible.length;
    const upcoming = visible
      .filter((t) => t.status !== "done")
      .sort((a, b) =>
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
      )[0];
    if (total > 0) {
      progress = {
        title: activeProject.title,
        id: activeProject.id,
        total,
        done,
        pct: Math.round((done / total) * 100),
        nextTask: upcoming?.title ?? null,
        nextDue: upcoming?.due_date ?? null,
      };
    }
  }

  const isBrandNew = projects.length === 0;
  const firstName = user.fullName?.split(" ")[0] ?? "der";

  return (
    <div className="space-y-8">
      {/* ========================================================
          Greeting + CTA
      ========================================================= */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Hei {firstName} <span className="inline-block">👋</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isBrandNew
              ? "La oss sende ut din første forespørsel — det tar under 2 minutter."
              : `${activeProjects} ${
                  activeProjects === 1 ? "aktivt prosjekt" : "aktive prosjekter"
                }${newBids > 0 ? ` · ${newBids} nye tilbud venter` : ""}.`}
          </p>
        </div>
        <Button asChild variant="brand" size="lg">
          <Link href="/kunde/prosjekter/ny">
            <Plus className="h-4 w-4" /> Ny forespørsel
          </Link>
        </Button>
      </div>

      {isBrandNew ? (
        <OnboardingCard />
      ) : (
        <>
          {/* ====================================================
              Stat cards
          ===================================================== */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Inbox className="h-4 w-4" />}
              label="Aktive prosjekter"
              value={String(activeProjects)}
            />
            <StatCard
              icon={<Zap className="h-4 w-4" />}
              label="Nye tilbud"
              value={String(newBids)}
              highlight={newBids > 0}
              href={
                newBids > 0 && projects[0]
                  ? `/kunde/prosjekter/${projects[0].id}`
                  : undefined
              }
            />
            <StatCard
              icon={<Wallet className="h-4 w-4" />}
              label="Fakturaer å betale"
              value={String(invoicesDueCount)}
              hint={
                invoicesDueCount > 0 ? formatCurrencyNOK(invoicesDueTotal) : undefined
              }
            />
            <StatCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Signerte avtaler"
              value={String(signedContracts.length)}
            />
          </div>

          {/* ====================================================
              Progress card for active project
          ===================================================== */}
          {progress ? (
            <Card className="overflow-hidden border-brand/30 bg-gradient-to-br from-brand/5 to-transparent">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-brand">
                      Aktivt prosjekt
                    </CardDescription>
                    <CardTitle className="mt-1 text-xl">
                      {progress.title}
                    </CardTitle>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">{progress.pct}%</div>
                    <div className="text-xs text-muted-foreground">
                      {progress.done} av {progress.total} oppgaver
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progress.pct} />
                {progress.nextTask ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Neste
                      </div>
                      <div className="mt-0.5 truncate font-medium">
                        {progress.nextTask}
                      </div>
                    </div>
                    {progress.nextDue ? (
                      <Badge variant="outline" className="shrink-0">
                        {formatDate(progress.nextDue)}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/kunde/prosjekter/${progress.id}`}>
                    Åpne prosjekt <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* ====================================================
              New bids pending review
          ===================================================== */}
          {bids.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-brand" />
                      Nye tilbud som venter på svar
                    </CardTitle>
                    <CardDescription>
                      Sammenlikn og velg hvilket byrå dere vil gå videre med.
                    </CardDescription>
                  </div>
                  {newBids > 0 ? (
                    <Badge variant="brand">{newBids} nye</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {bids.map((b) => {
                    const tenant = b.tenants as unknown as { name: string } | null;
                    const project = b.projects as unknown as {
                      title: string;
                    } | null;
                    const initials = (tenant?.name ?? "BY")
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase())
                      .join("");
                    return (
                      <Link
                        key={b.id}
                        href={`/kunde/tilbud/${b.id}`}
                        className="group rounded-lg border border-border bg-background p-4 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-bold text-brand">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">
                                {tenant?.name ?? "Byrå"}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {project?.title}
                              </div>
                            </div>
                          </div>
                          {b.status === "sent" ? (
                            <Badge variant="brand" className="shrink-0">
                              Ny
                            </Badge>
                          ) : null}
                        </div>
                        {b.summary ? (
                          <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                            {b.summary}
                          </p>
                        ) : null}
                        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                          <div>
                            <div className="text-xs text-muted-foreground">Pris</div>
                            <div className="text-sm font-semibold">
                              {formatCurrencyNOK(b.amount_nok)}
                            </div>
                          </div>
                          {b.delivery_weeks ? (
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">
                                Leveranse
                              </div>
                              <div className="text-sm font-semibold">
                                {b.delivery_weeks} uker
                              </div>
                            </div>
                          ) : null}
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* ====================================================
              Recent requests
          ===================================================== */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Siste forespørsler</CardTitle>
                  <CardDescription>De 5 nyeste forespørslene dine.</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/kunde/prosjekter">Se alle</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/kunde/prosjekter/${p.id}`}
                        className="block truncate font-medium hover:text-brand"
                      >
                        {p.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Opprettet {formatDate(p.created_at)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={p.status} />
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/kunde/prosjekter/${p.id}`}>
                          Åpne <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function OnboardingCard() {
  return (
    <Card className="border-brand/40 bg-gradient-to-br from-brand/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="h-5 w-5 text-brand" />
          Kom i gang på 2 minutter
        </CardTitle>
        <CardDescription>
          Beskriv prosjektet. AI fyller ut detaljene. Få tilbud fra 3–5
          matchende byråer innen 24 timer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="space-y-4">
          <OnboardingStep
            n={1}
            title="Beskriv prosjektet"
            body="Noen setninger holder. AI leser nettsiden din og fyller ut detaljene."
          />
          <OnboardingStep
            n={2}
            title="Motta tilbud"
            body="Opptil 5 matchende byråer varsles. Du får tilbudene på e-post og her i dashbordet."
          />
          <OnboardingStep
            n={3}
            title="Sammenlikn og velg"
            body="Still spørsmål, sammenlikn pris og leveranser side-om-side, signer med ett klikk."
          />
        </ol>
        <Button asChild variant="brand" size="lg">
          <Link href="/kunde/prosjekter/ny">
            Start din første forespørsel <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function StatCard({
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
      className={cn(
        "h-full transition-colors",
        highlight
          ? "border-brand/50 bg-brand text-brand-foreground shadow-lg shadow-brand/10"
          : href
            ? "hover:border-foreground/20"
            : "",
      )}
    >
      <CardHeader className="pb-2">
        <div
          className={cn(
            "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
            highlight ? "text-brand-foreground/80" : "text-muted-foreground",
          )}
        >
          {icon}
          {label}
        </div>
        <CardTitle
          className={cn(
            "text-3xl font-bold",
            highlight ? "text-brand-foreground" : "",
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0">
          <p
            className={cn(
              "text-xs",
              highlight
                ? "text-brand-foreground/80"
                : "text-muted-foreground",
            )}
          >
            {hint}
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

function OnboardingStep({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
        {n}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label: Record<string, string> = {
    draft: "Utkast",
    open: "Åpen",
    matched: "Matchet",
    in_progress: "Pågår",
    completed: "Fullført",
    cancelled: "Avbrutt",
  };
  const variant: Record<string, "outline" | "brand" | "secondary"> = {
    open: "brand",
    matched: "brand",
    in_progress: "brand",
    completed: "secondary",
    cancelled: "outline",
    draft: "outline",
  };
  return (
    <Badge variant={variant[status] ?? "outline"} className="capitalize">
      {label[status] ?? status}
    </Badge>
  );
}

