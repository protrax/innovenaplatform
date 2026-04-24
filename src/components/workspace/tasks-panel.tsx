"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";
import {
  Calendar,
  Check,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  User,
  Wand2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "cancelled";
  visibility: "shared" | "internal";
  due_date: string | null;
  assigned_to: string | null;
  source: "manual" | "ai_plan";
  created_at: string;
  completed_at: string | null;
}

export interface TaskMember {
  user_id: string;
  name: string;
}

const NEXT_STATUS: Record<Task["status"], Task["status"]> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
  cancelled: "todo",
};

export function TasksPanel({
  projectId,
  initialTasks,
  members,
  canEdit,
  canSeeInternal,
}: {
  projectId: string;
  initialTasks: Task[];
  members: TaskMember[];
  canEdit: boolean;
  canSeeInternal: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssignee, setNewAssignee] = useState<string>("");
  const [newVisibility, setNewVisibility] = useState<"shared" | "internal">(
    "shared",
  );
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setLoading(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        title: newTitle,
        assigned_to: newAssignee || null,
        due_date: newDueDate || null,
        visibility: newVisibility,
      }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) return;
    setTasks([...tasks, body.task]);
    setNewTitle("");
    setNewAssignee("");
    setNewDueDate("");
    setNewVisibility("shared");
    setShowForm(false);
    router.refresh();
  }

  async function toggleStatus(task: Task) {
    const nextStatus = NEXT_STATUS[task.status];
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: nextStatus,
              completed_at:
                nextStatus === "done" ? new Date().toISOString() : null,
            }
          : t,
      ),
    );
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  async function remove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }

  async function regeneratePlan() {
    if (
      !confirm(
        "Generere prosjektplanen på nytt? AI-genererte oppgaver erstattes. Manuelle oppgaver beholdes.",
      )
    )
      return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-plan`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Kunne ikke regenerere plan");
      }
    } finally {
      setRegenerating(false);
    }
  }

  const grouped = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    done: tasks.filter((t) => t.status === "done"),
  };

  const visibleTasks = tasks.filter(
    (t) => t.status !== "cancelled" && (canSeeInternal || t.visibility !== "internal"),
  );
  const completed = visibleTasks.filter((t) => t.status === "done").length;
  const total = visibleTasks.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Prosjektplan</CardTitle>
            <CardDescription>
              {canEdit
                ? "Styr leveransen. Klikk avkryssingen for å endre status."
                : "Oppgaver i prosjektet. Følg progresjonen live."}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canEdit ? (
              <Button
                size="sm"
                variant="outline"
                onClick={regeneratePlan}
                disabled={regenerating}
                title="Generer prosjektplan på nytt med AI basert på tilbudet"
              >
                {regenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Genererer…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3 w-3" /> AI-regen
                  </>
                )}
              </Button>
            ) : null}
            {canEdit && !showForm ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(true)}
              >
                <Plus className="h-4 w-4" /> Ny oppgave
              </Button>
            ) : null}
          </div>
        </div>
        {total > 0 ? (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {completed} av {total} oppgaver ferdig
              </span>
              <span className="font-medium">{progressPct}%</span>
            </div>
            <Progress value={progressPct} />
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm ? (
          <form onSubmit={create} className="space-y-3 rounded-md border border-border p-3">
            <Input
              autoFocus
              placeholder="Hva skal gjøres?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <select
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Ingen tildelt</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
              />
              <select
                value={newVisibility}
                onChange={(e) =>
                  setNewVisibility(e.target.value as "shared" | "internal")
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="shared">Synlig for kunde</option>
                <option value="internal">Kun internt</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
                disabled={loading}
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                variant="brand"
                size="sm"
                disabled={loading || !newTitle.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Lagrer…
                  </>
                ) : (
                  "Opprett"
                )}
              </Button>
            </div>
          </form>
        ) : null}

        {tasks.length === 0 && !showForm ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Ingen oppgaver ennå.
          </p>
        ) : (
          <div className="space-y-4">
            <TaskGroup
              label="Å gjøre"
              tasks={grouped.todo}
              members={members}
              canEdit={canEdit}
              canSeeInternal={canSeeInternal}
              onToggle={toggleStatus}
              onRemove={remove}
            />
            <TaskGroup
              label="Pågår"
              tasks={grouped.in_progress}
              members={members}
              canEdit={canEdit}
              canSeeInternal={canSeeInternal}
              onToggle={toggleStatus}
              onRemove={remove}
            />
            <TaskGroup
              label="Ferdig"
              tasks={grouped.done}
              members={members}
              canEdit={canEdit}
              canSeeInternal={canSeeInternal}
              onToggle={toggleStatus}
              onRemove={remove}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaskGroup({
  label,
  tasks,
  members,
  canEdit,
  canSeeInternal,
  onToggle,
  onRemove,
}: {
  label: string;
  tasks: Task[];
  members: TaskMember[];
  canEdit: boolean;
  canSeeInternal: boolean;
  onToggle: (t: Task) => void;
  onRemove: (id: string) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label} ({tasks.length})
      </div>
      <ul className="space-y-1.5">
        {tasks.map((task) => {
          const assignee = members.find((m) => m.user_id === task.assigned_to);
          const overdue =
            task.due_date &&
            task.status !== "done" &&
            new Date(task.due_date) < new Date(new Date().toDateString());
          return (
            <li
              key={task.id}
              className={cn(
                "group flex items-start gap-3 rounded-md border border-border p-3 transition-colors",
                task.status === "done" && "opacity-60",
              )}
            >
              <button
                type="button"
                onClick={() => canEdit && onToggle(task)}
                disabled={!canEdit}
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                  task.status === "done"
                    ? "border-brand bg-brand text-brand-foreground"
                    : task.status === "in_progress"
                      ? "border-brand bg-brand/20"
                      : "border-border hover:border-foreground/50",
                  !canEdit && "cursor-not-allowed",
                )}
                aria-label="Endre status"
              >
                {task.status === "done" ? (
                  <Check className="h-3 w-3" />
                ) : task.status === "in_progress" ? (
                  <span className="h-2 w-2 rounded-full bg-brand" />
                ) : null}
              </button>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "text-sm font-medium",
                    task.status === "done" && "line-through",
                  )}
                >
                  {task.title}
                  {task.visibility === "internal" && canSeeInternal ? (
                    <Badge
                      variant="outline"
                      className="ml-2 px-1.5 py-0 text-[10px]"
                    >
                      Intern
                    </Badge>
                  ) : null}
                  {task.source === "ai_plan" ? (
                    <span
                      className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-brand"
                      title="Generert av AI fra tilbudet"
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {assignee ? (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" /> {assignee.name}
                    </span>
                  ) : null}
                  {task.due_date ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        overdue && "text-destructive",
                      )}
                    >
                      <Calendar className="h-3 w-3" />
                      {formatDate(task.due_date)}
                    </span>
                  ) : null}
                </div>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => onRemove(task.id)}
                  className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label="Slett"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
