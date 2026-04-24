"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, formatCurrencyNOK } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";

interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  label: string | null;
  date: string;
  hours: number;
  description: string;
  billable: boolean;
  hourly_rate_nok: number | null;
  status: "draft" | "submitted" | "approved" | "invoiced";
}

interface ProjectOption {
  id: string;
  title: string;
}

interface Member {
  user_id: string;
  full_name: string | null;
  email: string;
}

const DAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

export function TimeTrackingView({
  tenantId,
  userId,
  isManager,
  weekStart,
  weekEnd,
  weekLabel,
  entries,
  projects,
  members,
}: {
  tenantId: string;
  userId: string;
  isManager: boolean;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  entries: TimeEntry[];
  projects: ProjectOption[];
  members: Member[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("1");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [billable, setBillable] = useState(true);
  const [rateNok, setRateNok] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = new Date(weekStart);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return { iso, label: DAY_LABELS[i], day: d.getUTCDate() };
    });
  }, [weekStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const d of days) map.set(d.iso, []);
    for (const e of entries) {
      const arr = map.get(e.date);
      if (arr) arr.push(e);
    }
    return map;
  }, [days, entries]);

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
  const billableHours = entries
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + Number(e.hours), 0);
  const totalValue = entries
    .filter((e) => e.billable && e.hourly_rate_nok)
    .reduce(
      (sum, e) => sum + Number(e.hours) * Number(e.hourly_rate_nok ?? 0),
      0,
    );

  function navWeek(deltaDays: number) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + deltaDays);
    router.push(`/byraa/timefoering?week=${d.toISOString().slice(0, 10)}`);
  }

  async function submitEntry(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim() || !hours || Number(hours) <= 0) {
      setError("Fyll ut beskrivelse og antall timer");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          project_id: projectId || null,
          label: !projectId && label ? label : null,
          date,
          hours: Number(hours),
          description,
          billable,
          hourly_rate_nok: rateNok ? Number(rateNok) : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Kunne ikke lagre");
        return;
      }
      setDescription("");
      setHours("1");
      setShowForm(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navWeek(-7)}
            aria-label="Forrige uke"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[160px] text-center font-medium">
            {weekLabel}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navWeek(7)}
            aria-label="Neste uke"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/byraa/timefoering")}
          >
            I dag
          </Button>
        </div>
        <Button
          variant="brand"
          onClick={() => {
            setShowForm(true);
            setDate(new Date().toISOString().slice(0, 10));
          }}
        >
          <Plus className="h-4 w-4" /> Logg tid
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Totalt denne uken" value={`${totalHours.toFixed(1)}t`} />
        <StatCard
          label="Fakturerbart"
          value={`${billableHours.toFixed(1)}t`}
          hint={`${((billableHours / (totalHours || 1)) * 100).toFixed(0)}% av total`}
        />
        <StatCard
          label="Beregnet verdi"
          value={totalValue > 0 ? formatCurrencyNOK(totalValue) : "—"}
          hint="Basert på timepris på postene"
        />
      </div>

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Ny tidsoppføring</CardTitle>
            <CardDescription>
              Logg det du jobbet med. Du kan redigere eller slette senere.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitEntry} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="te-date">Dato</Label>
                <Input
                  id="te-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="te-hours">Timer</Label>
                <Input
                  id="te-hours"
                  type="number"
                  step={0.25}
                  min={0.25}
                  max={24}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="te-project">Prosjekt</Label>
                <select
                  id="te-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— Annet / internt —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              {!projectId ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="te-label">Aktivitet (hvis ikke prosjekt)</Label>
                  <Input
                    id="te-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="F.eks. Salgsmøte, Intern opplæring, Admin"
                  />
                </div>
              ) : null}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="te-desc">Beskrivelse</Label>
                <Textarea
                  id="te-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Hva jobbet du med?"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="te-rate">Timepris (valgfritt)</Label>
                <Input
                  id="te-rate"
                  type="number"
                  min={0}
                  value={rateNok}
                  onChange={(e) => setRateNok(e.target.value)}
                  placeholder="F.eks. 1200"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={billable}
                    onChange={(e) => setBillable(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Fakturerbart
                </label>
              </div>
              {error ? (
                <p className="sm:col-span-2 text-sm text-destructive">{error}</p>
              ) : null}
              <div className="flex items-center justify-end gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                  disabled={loading}
                >
                  Avbryt
                </Button>
                <Button type="submit" variant="brand" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Lagrer…
                    </>
                  ) : (
                    "Lagre"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
        {days.map((d) => {
          const dayEntries = byDay.get(d.iso) ?? [];
          const dayTotal = dayEntries.reduce(
            (sum, e) => sum + Number(e.hours),
            0,
          );
          return (
            <div
              key={d.iso}
              className="flex flex-col rounded-md border border-border bg-card"
            >
              <div className="flex items-center justify-between border-b border-border px-2 py-1.5 text-xs">
                <span className="font-medium">
                  {d.label} {d.day}
                </span>
                <span
                  className={cn(
                    "text-muted-foreground",
                    dayTotal > 0 && "font-semibold text-foreground",
                  )}
                >
                  {dayTotal > 0 ? `${dayTotal.toFixed(1)}t` : ""}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-2">
                {dayEntries.length === 0 ? (
                  <div className="text-xs text-muted-foreground/60">—</div>
                ) : (
                  dayEntries.map((e) => (
                    <TimeEntryRow
                      key={e.id}
                      entry={e}
                      projects={projects}
                      members={members}
                      canDelete={e.user_id === userId && e.status === "draft"}
                      isManager={isManager}
                      onDelete={() => deleteEntry(e.id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ProjectSummary
        entries={entries}
        projects={projects}
        weekStart={weekStart}
        weekEnd={weekEnd}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

function TimeEntryRow({
  entry,
  projects,
  members,
  canDelete,
  isManager,
  onDelete,
}: {
  entry: TimeEntry;
  projects: ProjectOption[];
  members: Member[];
  canDelete: boolean;
  isManager: boolean;
  onDelete: () => void;
}) {
  const project = projects.find((p) => p.id === entry.project_id);
  const author = members.find((m) => m.user_id === entry.user_id);
  return (
    <div className="group rounded bg-background p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium">
            {project?.title ?? entry.label ?? "Annet"}
          </div>
          <div className="mt-0.5 line-clamp-2 text-muted-foreground">
            {entry.description}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{Number(entry.hours).toFixed(1)}t</div>
          {!entry.billable ? (
            <Badge variant="outline" className="mt-0.5 px-1 py-0 text-[10px]">
              Ikke fakt.
            </Badge>
          ) : null}
        </div>
      </div>
      {isManager && author ? (
        <div className="mt-1 text-[10px] text-muted-foreground">
          {author.full_name ?? author.email}
        </div>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" /> Slett
        </button>
      ) : null}
    </div>
  );
}

function ProjectSummary({
  entries,
  projects,
  weekStart,
  weekEnd,
}: {
  entries: TimeEntry[];
  projects: ProjectOption[];
  weekStart: string;
  weekEnd: string;
}) {
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { title: string; hours: number; billable: number; value: number }
    >();
    for (const e of entries) {
      const key = e.project_id ?? `label:${e.label ?? "Annet"}`;
      const title = e.project_id
        ? (projects.find((p) => p.id === e.project_id)?.title ?? "Ukjent")
        : (e.label ?? "Annet");
      const existing = map.get(key) ?? {
        title,
        hours: 0,
        billable: 0,
        value: 0,
      };
      existing.hours += Number(e.hours);
      if (e.billable) {
        existing.billable += Number(e.hours);
        existing.value += Number(e.hours) * Number(e.hourly_rate_nok ?? 0);
      }
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  }, [entries, projects]);

  if (grouped.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Oppsummering</CardTitle>
        <CardDescription>
          {weekStart} – {weekEnd}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {grouped.map((g) => (
            <li
              key={g.title}
              className="flex items-center justify-between py-2 text-sm"
            >
              <div className="flex-1">
                <div className="font-medium">{g.title}</div>
                <div className="text-xs text-muted-foreground">
                  {g.billable.toFixed(1)}t fakturerbart av {g.hours.toFixed(1)}t
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{g.hours.toFixed(1)}t</div>
                {g.value > 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {formatCurrencyNOK(g.value)}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

