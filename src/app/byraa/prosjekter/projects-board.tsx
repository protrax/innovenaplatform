"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import { cn, formatCurrencyNOK, formatDate } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Calendar, GripVertical, User } from "lucide-react";
import { PHASES, phaseDef, type ProjectPhase } from "@/lib/project-phases";

export interface ProjectBoardCard {
  id: string;
  title: string;
  phase: string;
  customer_name: string;
  contract_value: number | null;
  deadline: string | null;
  tasks_done: number;
  tasks_total: number;
  contract_id: string;
}

export function ProjectsBoard({ cards }: { cards: ProjectBoardCard[] }) {
  const router = useRouter();
  const [local, setLocal] = useState(cards);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const cardsByPhase = useMemo(() => {
    const map = new Map<string, ProjectBoardCard[]>();
    for (const p of PHASES) map.set(p.id, []);
    for (const c of local) {
      const arr = map.get(c.phase) ?? map.get("oppstart");
      arr?.push(c);
    }
    return map;
  }, [local]);

  const activeCards = local.filter((c) => c.phase !== "fullfort");
  const doneCards = local.filter((c) => c.phase === "fullfort");
  const totalValue = activeCards.reduce(
    (s, c) => s + (c.contract_value ?? 0),
    0,
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const cardId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const card = local.find((c) => c.id === cardId);
    if (!card || card.phase === overId) return;

    setLocal((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, phase: overId } : c)),
    );

    const res = await fetch(`/api/projects/${cardId}/phase`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase: overId }),
    });
    if (!res.ok) {
      setLocal((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, phase: card.phase } : c)),
      );
    } else {
      router.refresh();
    }
  }

  return (
    <>
      {/* Header — stays in place */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Prosjekter</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {activeCards.length}
            </span>{" "}
            aktive
            {totalValue > 0 ? (
              <>
                {" "}
                · kontraktverdi{" "}
                <span className="font-medium text-foreground">
                  {formatCurrencyNOK(totalValue)}
                </span>
              </>
            ) : null}
            {doneCards.length > 0 ? ` · ${doneCards.length} fullført` : ""}
          </p>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-4">
          {PHASES.map((p) => (
            <PhaseColumn
              key={p.id}
              phase={p.id}
              label={p.label}
              description={p.description}
              color={p.color}
              done={p.done}
              cards={cardsByPhase.get(p.id) ?? []}
            />
          ))}
        </div>
        <DragOverlay>
          {activeId
            ? (() => {
                const card = local.find((c) => c.id === activeId);
                return card ? <ProjectCard card={card} dragging /> : null;
              })()
            : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function PhaseColumn({
  phase,
  label,
  description,
  color,
  done,
  cards,
}: {
  phase: ProjectPhase;
  label: string;
  description: string;
  color: string;
  done?: boolean;
  cards: ProjectBoardCard[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: phase });
  const value = cards.reduce((s, c) => s + (c.contract_value ?? 0), 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-72 shrink-0 flex-col rounded-lg border bg-card transition-colors",
        isOver ? "border-brand bg-brand/5" : "border-border",
        done ? "opacity-75" : "",
      )}
    >
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: color }}
            />
            <span className="text-sm font-semibold">{label}</span>
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
              {cards.length}
            </span>
          </div>
          {value > 0 ? (
            <span className="text-[11px] font-medium text-muted-foreground">
              {formatCurrencyNOK(value)}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 p-3">
          {cards.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Dra prosjekter hit
            </div>
          ) : (
            cards.map((c) => <DraggableProjectCard key={c.id} card={c} />)
          )}
        </div>
      </div>
    </div>
  );
}

function DraggableProjectCard({ card }: { card: ProjectBoardCard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group rounded-md border border-border bg-background p-3 shadow-sm transition-shadow",
        isDragging ? "opacity-30" : "hover:shadow-md",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground opacity-40 hover:opacity-100 active:cursor-grabbing"
          aria-label="Dra"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Link
          href={`/byraa/prosjekter/${card.id}`}
          className="min-w-0 flex-1"
        >
          <div className="line-clamp-2 text-sm font-medium">{card.title}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate">{card.customer_name}</span>
          </div>
          {card.tasks_total > 0 ? (
            <div className="mt-2 space-y-1">
              <Progress
                value={Math.round((card.tasks_done / card.tasks_total) * 100)}
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {card.tasks_done}/{card.tasks_total} oppgaver
                </span>
                {card.deadline ? (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    {formatDate(card.deadline)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          {card.contract_value ? (
            <div className="mt-2 text-[11px] font-semibold text-brand">
              {formatCurrencyNOK(card.contract_value)}
            </div>
          ) : null}
        </Link>
      </div>
    </div>
  );
}

function ProjectCard({
  card,
  dragging,
}: {
  card: ProjectBoardCard;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-72 rounded-md border border-border bg-background p-3 text-sm shadow-lg",
        dragging && "rotate-2",
      )}
    >
      <div className="font-medium">{card.title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{card.customer_name}</div>
    </div>
  );
}

// Export phase definitions for consumers
export { phaseDef };
