import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TasksPanel } from "@/components/workspace/tasks-panel";
import { MessagesPanel } from "@/components/workspace/messages-panel";
import { FilesPanel } from "@/components/workspace/files-panel";
import { fetchWorkspaceData } from "@/lib/workspace";
import { markThreadRead } from "@/lib/messages";
import { formatCurrencyNOK, formatDate } from "@/lib/utils";
import { PHASES, phaseDef } from "@/lib/project-phases";
import { ArrowLeft, Calendar, User, Wallet } from "lucide-react";
import { PhaseSelector } from "./phase-selector";

export const dynamic = "force-dynamic";

export default async function ProsjektDetalj({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  if (!tenantId) notFound();

  const supabase = await createClient();

  // Verify tenant has active contract
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, amount_nok, status, created_at, customer_id")
    .eq("project_id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!contract) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, description, phase, status, deadline, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: customer } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", contract.customer_id)
    .maybeSingle();

  const workspace = await fetchWorkspaceData({
    projectId: id,
    tenantId,
    customerId: contract.customer_id,
    includeInternal: true,
  });

  await markThreadRead({ projectId: id, userId: user.id });

  // Progress: only top-level shared tasks count for the customer
  const visibleTasks = workspace.tasks.filter(
    (t) => t.status !== "cancelled",
  );
  const done = visibleTasks.filter((t) => t.status === "done").length;
  const total = visibleTasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const currentPhase = phaseDef(project.phase);

  return (
    <div className="space-y-6">
      {/* ===================================================
          Header
      ==================================================== */}
      <div>
        <Link
          href="/byraa/prosjekter"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Alle prosjekter
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {customer?.full_name ?? customer?.email ?? "Kunde"}
              </span>
              {contract.amount_nok ? (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5" />
                    {formatCurrencyNOK(contract.amount_nok)}
                  </span>
                </>
              ) : null}
              {project.deadline ? (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Frist {formatDate(project.deadline)}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <PhaseSelector projectId={id} currentPhase={project.phase} />
        </div>
      </div>

      {/* ===================================================
          Phase timeline
      ==================================================== */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Fremdrift
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: currentPhase.color }}
                />
                <span className="font-semibold">{currentPhase.label}</span>
                <span className="text-sm text-muted-foreground">
                  · {currentPhase.description}
                </span>
              </div>
            </div>
            {total > 0 ? (
              <div className="text-right">
                <div className="text-2xl font-bold">{pct}%</div>
                <div className="text-xs text-muted-foreground">
                  {done} av {total} oppgaver
                </div>
              </div>
            ) : null}
          </div>

          {/* Phase dots timeline */}
          <div className="flex items-center gap-2">
            {PHASES.map((p, i) => {
              const currentIdx = PHASES.findIndex(
                (x) => x.id === project.phase,
              );
              const passed = i < currentIdx;
              const current = i === currentIdx;
              return (
                <div
                  key={p.id}
                  className="flex flex-1 items-center gap-2"
                  title={p.label}
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      passed
                        ? "bg-brand text-brand-foreground"
                        : current
                          ? "bg-brand text-brand-foreground ring-4 ring-brand/20"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {passed ? "✓" : i + 1}
                  </div>
                  {i < PHASES.length - 1 ? (
                    <div
                      className={`h-0.5 flex-1 ${
                        passed ? "bg-brand" : "bg-muted"
                      }`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            {PHASES.map((p) => (
              <div key={p.id} className="flex-1 truncate">
                {p.label}
              </div>
            ))}
          </div>

          {total > 0 ? <Progress className="mt-5" value={pct} /> : null}
        </CardContent>
      </Card>

      {/* ===================================================
          Brief
      ==================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kundens brief</CardTitle>
          <CardDescription>Fra forespørselen som ble akseptert.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {project.description}
          </p>
        </CardContent>
      </Card>

      {/* ===================================================
          Workspace panels (same as /byraa/leads)
      ==================================================== */}
      <TasksPanel
        projectId={id}
        initialTasks={workspace.tasks}
        members={workspace.members}
        canEdit={true}
        canSeeInternal={true}
      />

      <div className="grid gap-6 lg:grid-cols-2">
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
          canSeeInternal={true}
          canUploadInternal={true}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/byraa/leads/${id}`}>Se opprinnelig lead</Link>
        </Button>
        <Badge variant="outline" className="text-[10px]">
          Kontrakt signert {formatDate(contract.created_at)}
        </Badge>
      </div>
    </div>
  );
}
