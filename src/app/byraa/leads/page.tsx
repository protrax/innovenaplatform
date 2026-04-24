import Link from "next/link";
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
import { formatDate } from "@/lib/utils";

export default async function LeadsPage() {
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  if (!tenantId) {
    return <p className="text-sm text-muted-foreground">Ingen tenant funnet.</p>;
  }

  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("project_leads")
    .select(
      "id, distributed_at, viewed_at, dismissed_at, projects!inner(id, title, description, budget_min_nok, budget_max_nok, status)",
    )
    .eq("tenant_id", tenantId)
    .is("dismissed_at", null)
    .order("distributed_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Leads</h2>
        <p className="text-sm text-muted-foreground">
          Forespørsler distribuert til ditt byrå.
        </p>
      </div>

      {!leads || leads.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen aktive leads</CardTitle>
            <CardDescription>
              Sørg for at du har lagt til kategoriene du jobber med under
              Innstillinger for å motta matchende prosjekter.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {leads.map((l) => (
            // @ts-expect-error — joined row
            <LeadRow key={l.id} lead={l} project={l.projects} />
          ))}
        </div>
      )}
    </div>
  );
}

interface LeadWithProject {
  id: string;
  distributed_at: string;
  viewed_at: string | null;
}

interface ProjectRow {
  id: string;
  title: string;
  description: string;
  status: string;
}

function LeadRow({
  lead,
  project,
}: {
  lead: LeadWithProject;
  project: ProjectRow;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{project.title}</CardTitle>
            <CardDescription>
              Mottatt {formatDate(lead.distributed_at)} · {project.status}
            </CardDescription>
          </div>
          {!lead.viewed_at ? <Badge variant="brand">Ny</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <p className="line-clamp-2 pr-4 text-sm text-muted-foreground">
          {project.description}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/byraa/leads/${project.id}`}>Se detaljer</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
