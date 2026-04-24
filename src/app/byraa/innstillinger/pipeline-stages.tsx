"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2 } from "lucide-react";

export interface Stage {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
}

const PRESET_COLORS = [
  "#94a3b8",
  "#3b82f6",
  "#eab308",
  "#f97316",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

export function PipelineStagesManager({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial: Stage[];
}) {
  const router = useRouter();
  const [stages, setStages] = useState(initial);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!newName.trim()) return;
    setLoading("create");
    setError(null);
    const res = await fetch("/api/pipeline/stages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenantId,
        name: newName,
        color: PRESET_COLORS[stages.length % PRESET_COLORS.length],
      }),
    });
    const body = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(body.error ?? "Kunne ikke lage stadium");
      return;
    }
    setStages([...stages, body.stage]);
    setNewName("");
    router.refresh();
  }

  async function update(id: string, patch: Partial<Stage>) {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
    await fetch(`/api/pipeline/stages/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function remove(id: string) {
    setLoading(id);
    setError(null);
    const res = await fetch(`/api/pipeline/stages/${id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setError(body.error ?? "Kunne ikke slette");
      return;
    }
    setStages((prev) => prev.filter((s) => s.id !== id));
    router.refresh();
  }

  async function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...stages];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setStages(next);
    await fetch("/api/pipeline/stages/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenantId,
        stage_ids: next.map((s) => s.id),
      }),
    });
  }

  async function moveDown(idx: number) {
    if (idx === stages.length - 1) return;
    const next = [...stages];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setStages(next);
    await fetch("/api/pipeline/stages/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenantId,
        stage_ids: next.map((s) => s.id),
      }),
    });
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {stages.map((stage, i) => (
          <li
            key={stage.id}
            className="flex items-center gap-3 rounded-md border border-border p-3"
          >
            <input
              type="color"
              value={stage.color ?? "#94a3b8"}
              onChange={(e) => update(stage.id, { color: e.target.value })}
              className="h-7 w-7 cursor-pointer rounded border border-border"
              aria-label="Farge"
            />
            <Input
              value={stage.name}
              onChange={(e) =>
                setStages((prev) =>
                  prev.map((s) =>
                    s.id === stage.id ? { ...s, name: e.target.value } : s,
                  ),
                )
              }
              onBlur={() => update(stage.id, { name: stage.name })}
              className="h-8 flex-1"
            />
            {stage.is_won ? <Badge variant="brand">Vunnet</Badge> : null}
            {stage.is_lost ? <Badge variant="destructive">Tapt</Badge> : null}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => moveUp(i)}
                disabled={i === 0}
                aria-label="Opp"
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => moveDown(i)}
                disabled={i === stages.length - 1}
                aria-label="Ned"
              >
                ↓
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(stage.id)}
                disabled={loading === stage.id || stage.is_won || stage.is_lost}
                aria-label="Slett"
              >
                {loading === stage.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <Label htmlFor="new-stage" className="sr-only">
          Nytt stadium
        </Label>
        <Input
          id="new-stage"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          }}
          placeholder="F.eks. Møte booket"
        />
        <Button
          type="button"
          variant="outline"
          onClick={create}
          disabled={!newName.trim() || loading === "create"}
        >
          {loading === "create" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Legg til
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <p className="text-xs text-muted-foreground">
        Vunnet og Tapt-stadier er beskyttet — de kan ikke slettes og oppdateres
        automatisk av plattformen når kunden aksepterer eller avslår tilbud.
      </p>
    </div>
  );
}
