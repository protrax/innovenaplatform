import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TimeTrackingView } from "./time-view";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Search = Promise<{ week?: string }>;

export default async function TimefoeringPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  const { week: weekParam } = await searchParams;

  if (!tenantId) {
    return <p className="text-sm text-muted-foreground">Ingen tenant funnet.</p>;
  }

  // Parse ?week=YYYY-MM-DD (defaults to today's week)
  const today = new Date();
  const anchor = weekParam ? new Date(weekParam) : today;
  const { weekStart, weekEnd, weekLabel } = getIsoWeek(anchor);

  const supabase = await createClient();

  // Check if user is tenant owner/admin (can see all entries) or just a member (own only)
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();
  const isManager =
    membership?.role === "owner" || membership?.role === "admin";

  const [entriesRes, projectsRes, membersRes] = await Promise.all([
    (() => {
      const q = supabase
        .from("time_entries")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("date", weekStart)
        .lte("date", weekEnd)
        .order("date", { ascending: true });
      return isManager ? q : q.eq("user_id", user.id);
    })(),
    // Projects the tenant has leads on — these are the valid options to log time against
    supabase
      .from("project_leads")
      .select("projects!inner(id, title)")
      .eq("tenant_id", tenantId),
    supabase
      .from("tenant_members")
      .select("user_id, profiles!inner(full_name, email)")
      .eq("tenant_id", tenantId),
  ]);

  const entries = entriesRes.data ?? [];
  const projects = (projectsRes.data ?? [])
    .map((r) => r.projects as unknown as { id: string; title: string } | null)
    .filter((p): p is { id: string; title: string } => p !== null);
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Timeføring</h2>
        <p className="text-sm text-muted-foreground">
          Logg timer pr. prosjekt. {isManager ? "Du ser alle i teamet." : "Du ser dine egne timer."}
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen aktive prosjekter</CardTitle>
            <CardDescription>
              Du får tilgang til å logge timer på prosjekter når ditt byrå har
              mottatt leads. Logg timer på &ldquo;Annet&rdquo; i mellomtiden.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <TimeTrackingView
        tenantId={tenantId}
        userId={user.id}
        isManager={isManager}
        weekStart={weekStart}
        weekEnd={weekEnd}
        weekLabel={weekLabel}
        entries={entries}
        projects={projects}
        members={members}
      />
    </div>
  );
}

function getIsoWeek(date: Date): {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
} {
  // ISO week starts Monday
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = d.getUTCDay() || 7; // Sunday = 7
  d.setUTCDate(d.getUTCDate() - day + 1);
  const start = d.toISOString().slice(0, 10);
  const endD = new Date(d);
  endD.setUTCDate(endD.getUTCDate() + 6);
  const end = endD.toISOString().slice(0, 10);

  // Week number (simplified)
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const weekNumber =
    1 +
    Math.round(
      ((d.getTime() - jan4.getTime()) / 86400000 -
        3 +
        ((jan4.getUTCDay() + 6) % 7)) /
        7,
    );

  return {
    weekStart: start,
    weekEnd: end,
    weekLabel: `Uke ${weekNumber} · ${d.getUTCFullYear()}`,
  };
}
