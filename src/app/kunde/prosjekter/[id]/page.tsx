import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyNOK, formatDate } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { TasksPanel } from "@/components/workspace/tasks-panel";
import { MessagesPanel } from "@/components/workspace/messages-panel";
import { FilesPanel } from "@/components/workspace/files-panel";
import { fetchWorkspaceData } from "@/lib/workspace";
import { markThreadRead } from "@/lib/messages";

export default async function KundeProsjektDetalj({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: bids } = await supabase
    .from("bids")
    .select(
      "id, amount_nok, description, status, delivery_weeks, created_at, tenant_id, tenants!inner(name, logo_url)",
    )
    .eq("project_id", id)
    .in("status", ["sent", "viewed", "accepted", "rejected"])
    .order("created_at", { ascending: false });

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, description, amount_nok, total_nok, platform_fee_nok, status, stripe_payment_link_url, created_at, paid_at, tenants!inner(name)",
    )
    .eq("customer_id", user.id)
    .in("status", ["sent", "paid", "overdue"])
    .order("created_at", { ascending: false });

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, title, amount_nok, status, created_at, tenant_id, tenants!inner(name)")
    .eq("project_id", id)
    .eq("customer_id", user.id)
    .maybeSingle();

  const workspace = await fetchWorkspaceData({
    projectId: id,
    tenantId: contract?.tenant_id ?? null,
    customerId: user.id,
    includeInternal: false,
  });

  await markThreadRead({ projectId: id, userId: user.id });

  const hasContract = contract !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/kunde/prosjekter"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← Tilbake til prosjekter
          </Link>
          <h2 className="mt-1 text-2xl font-semibold">{project.title}</h2>
          <p className="text-sm text-muted-foreground">
            Opprettet {formatDate(project.created_at)}
          </p>
        </div>
        <Badge variant="secondary">{project.status}</Badge>
      </div>

      {contract ? (
        <Card className="border-brand/40 bg-brand/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-brand-foreground">
                ✓
              </span>
              Signert avtale
            </CardTitle>
            <CardDescription>
              Med{" "}
              {(contract.tenants as unknown as { name: string } | null)?.name ??
                "byrå"}{" "}
              · {formatCurrencyNOK(contract.amount_nok)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="brand" size="sm">
              <Link href={`/kontrakter/${contract.id}`}>Åpne avtalen</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Detaljer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Markdown>{project.description}</Markdown>
          {(project.budget_min_nok || project.budget_max_nok) && (
            <p className="text-muted-foreground">
              Budsjett:{" "}
              {project.budget_min_nok
                ? formatCurrencyNOK(project.budget_min_nok)
                : "?"}{" "}
              –{" "}
              {project.budget_max_nok
                ? formatCurrencyNOK(project.budget_max_nok)
                : "?"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Tilbud ({bids?.length ?? 0})</CardTitle>
              <CardDescription>
                Byråer som har sendt tilbud på denne forespørselen.
              </CardDescription>
            </div>
            {bids && bids.length > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/kunde/prosjekter/${id}/sammenlign`}>
                  Sammenlikn
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {!bids || bids.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Ingen tilbud mottatt ennå. Matchende byråer blir varslet — det kan
              ta litt tid før du får de første tilbudene.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {bids.map((b) => {
                const tenant = b.tenants as unknown as {
                  name: string;
                  logo_url: string | null;
                } | null;
                const isNew = b.status === "sent";
                return (
                  <li
                    key={b.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <div className="font-medium">{tenant?.name ?? "Byrå"}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrencyNOK(b.amount_nok)}
                        {b.delivery_weeks ? ` · ${b.delivery_weeks} uker` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isNew ? <Badge variant="brand">Nytt</Badge> : null}
                      {b.status === "accepted" ? (
                        <Badge variant="brand">Akseptert</Badge>
                      ) : null}
                      {b.status === "rejected" ? (
                        <Badge variant="outline">Avslått</Badge>
                      ) : null}
                      {b.status === "viewed" ? (
                        <Badge variant="outline">Sett</Badge>
                      ) : null}
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/kunde/tilbud/${b.id}`}>Se tilbud</Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {hasContract ? (
        <>
          <TasksPanel
            projectId={id}
            initialTasks={workspace.tasks}
            members={workspace.members}
            canEdit={false}
            canSeeInternal={false}
          />

          <MessagesPanel
            projectId={id}
            currentUserId={user.id}
            initialMessages={workspace.messages}
            actors={workspace.actors}
          />

          <FilesPanel
            projectId={id}
            initialFiles={workspace.files}
            currentUserId={user.id}
            canSeeInternal={false}
            canUploadInternal={false}
          />
        </>
      ) : null}

      {invoices && invoices.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Fakturaer</CardTitle>
            <CardDescription>
              Betal trygt med kort via Stripe. Kvittering sendes til e-posten din.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {invoices.map((inv) => {
                const invTenant = inv.tenants as unknown as {
                  name: string;
                } | null;
                return (
                  <li
                    key={inv.id}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {inv.description ?? "Faktura"}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Fra {invTenant?.name ?? "Byrå"} ·{" "}
                        {formatDate(inv.created_at)}
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {formatCurrencyNOK(inv.total_nok)}
                        {inv.platform_fee_nok > 0 ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (inkl. {formatCurrencyNOK(inv.platform_fee_nok)}{" "}
                            servicegebyr)
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={
                          inv.status === "paid"
                            ? "brand"
                            : inv.status === "overdue"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {inv.status === "paid"
                          ? "Betalt"
                          : inv.status === "overdue"
                            ? "Forfalt"
                            : "Å betale"}
                      </Badge>
                      {inv.status !== "paid" && inv.stripe_payment_link_url ? (
                        <Button asChild size="sm" variant="brand">
                          <a
                            href={inv.stripe_payment_link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Betal nå <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
