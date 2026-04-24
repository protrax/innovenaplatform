import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PipelineBoard } from "./pipeline-board";
import type { PipelineCard } from "./pipeline-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  if (!tenantId) {
    return <p className="text-sm text-muted-foreground">Ingen tenant funnet.</p>;
  }

  const supabase = await createClient();
  const [stagesRes, cardsRes, membersRes] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    supabase
      .from("pipeline_cards")
      .select(
        `id, stage_id, sort_order, notes, assigned_to, title, value_nok,
         project:projects(id, title, description, budget_min_nok, budget_max_nok, status, created_at),
         contact:contacts(id, full_name, email, phone, company, lifecycle_stage)`,
      )
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    supabase
      .from("tenant_members")
      .select("user_id, profiles!inner(full_name, email)")
      .eq("tenant_id", tenantId),
  ]);

  const stages = stagesRes.data ?? [];
  const rawCards = cardsRes.data ?? [];

  // Fetch each tenant's latest bid per project in one roundtrip. Only cards
  // with a project can have bids; contact-only cards are manual leads.
  const projectIds = rawCards
    .map((c) => (c.project as unknown as { id: string } | null)?.id)
    .filter((id): id is string => Boolean(id));
  const { data: bids } = projectIds.length
    ? await supabase
        .from("bids")
        .select("project_id, amount_nok, status, created_at")
        .eq("tenant_id", tenantId)
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
    : { data: [] as { project_id: string; amount_nok: number; status: string }[] };
  const bidByProject = new Map<string, { amount_nok: number; status: string }>();
  for (const b of bids ?? []) {
    if (!bidByProject.has(b.project_id)) {
      bidByProject.set(b.project_id, { amount_nok: b.amount_nok, status: b.status });
    }
  }

  const cards: PipelineCard[] = rawCards.map((c) => {
    const project = c.project as unknown as PipelineCard["project"] | null;
    const contact = c.contact as unknown as PipelineCard["contact"] | null;
    return {
      id: c.id,
      stage_id: c.stage_id,
      sort_order: c.sort_order,
      notes: c.notes,
      assigned_to: c.assigned_to,
      title: c.title,
      value_nok: c.value_nok,
      project,
      contact,
      latest_bid: project ? bidByProject.get(project.id) ?? null : null,
    };
  });

  const members = (membersRes.data ?? []).map((m) => {
    const profile = m.profiles as unknown as {
      full_name: string | null;
      email: string;
    };
    return {
      user_id: m.user_id,
      full_name: profile.full_name,
      email: profile.email,
    };
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-0 min-w-0 flex-col">
      {stages.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen stadier</CardTitle>
            <CardDescription>
              Stadier opprettes automatisk ved tenant-opprettelse. Kontakt support
              hvis de mangler.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <PipelineBoard stages={stages} cards={cards} members={members} />
      )}
    </div>
  );
}
