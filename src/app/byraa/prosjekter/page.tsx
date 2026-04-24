import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProjectsBoard, type ProjectBoardCard } from "./projects-board";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ProsjekterPage() {
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  if (!tenantId) {
    return <p className="text-sm text-muted-foreground">Ingen tenant funnet.</p>;
  }

  const supabase = await createClient();

  // A "project" in this view is any contract where this tenant has won and
  // is delivering. We look up via contracts since that's the source of truth
  // for who owns delivery.
  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      `id, amount_nok, status, created_at,
       projects!inner(
         id, title, phase, status, deadline, customer_id, created_at
       )`,
    )
    .eq("tenant_id", tenantId)
    .in("status", ["signed", "active", "completed"])
    .order("created_at", { ascending: false });

  const projectIds = (contracts ?? [])
    .map((c) => (c.projects as unknown as { id: string })?.id)
    .filter(Boolean);

  // Fetch task progress per project
  const { data: taskRows } = projectIds.length
    ? await supabase
        .from("project_tasks")
        .select("project_id, status, visibility, parent_id")
        .in("project_id", projectIds)
        .is("parent_id", null) // only top-level tasks count toward progress
        .neq("status", "cancelled")
    : { data: [] as { project_id: string; status: string }[] };

  const progressByProject = new Map<string, { done: number; total: number }>();
  for (const t of taskRows ?? []) {
    const p = progressByProject.get(t.project_id) ?? { done: 0, total: 0 };
    p.total += 1;
    if (t.status === "done") p.done += 1;
    progressByProject.set(t.project_id, p);
  }

  // Fetch customer names
  const customerIds = Array.from(
    new Set(
      (contracts ?? []).map(
        (c) => (c.projects as unknown as { customer_id: string })?.customer_id,
      ),
    ),
  ).filter(Boolean);

  const { data: customers } = customerIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", customerIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const customerById = new Map(
    (customers ?? []).map((c) => [c.id, c.full_name ?? c.email ?? ""]),
  );

  const cards: ProjectBoardCard[] = (contracts ?? []).map((c) => {
    const project = c.projects as unknown as {
      id: string;
      title: string;
      phase: string;
      status: string;
      deadline: string | null;
      customer_id: string;
      created_at: string;
    };
    const progress = progressByProject.get(project.id) ?? { done: 0, total: 0 };
    return {
      id: project.id,
      title: project.title,
      phase: project.phase,
      customer_name: customerById.get(project.customer_id) ?? "Kunde",
      contract_value: c.amount_nok,
      deadline: project.deadline,
      tasks_done: progress.done,
      tasks_total: progress.total,
      contract_id: c.id,
    };
  });

  if (cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Ingen prosjekter ennå</CardTitle>
            <CardDescription>
              Prosjekter dukker opp her så snart en kunde signerer et av
              tilbudene dere har sendt. AI genererer oppgaver og milepæler
              automatisk.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-0 min-w-0 flex-col">
      <ProjectsBoard cards={cards} />
    </div>
  );
}
