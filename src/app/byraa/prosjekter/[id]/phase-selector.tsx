"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PHASES, phaseDef } from "@/lib/project-phases";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export function PhaseSelector({
  projectId,
  currentPhase,
}: {
  projectId: string;
  currentPhase: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, startTransition] = useTransition();
  const current = phaseDef(currentPhase);

  async function change(nextPhase: string) {
    setOpen(false);
    if (nextPhase === currentPhase) return;
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/phase`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phase: nextPhase }),
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent",
          loading && "opacity-50",
        )}
      >
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: current.color }}
        />
        {current.label}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[220px] rounded-md border border-border bg-card p-1 shadow-lg">
          {PHASES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => change(p.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                p.id === currentPhase && "bg-accent",
              )}
            >
              <span
                className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: p.color }}
              />
              <span>
                <span className="font-medium">{p.label}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {p.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
