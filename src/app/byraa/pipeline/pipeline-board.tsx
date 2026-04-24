"use client";

import { useMemo, useState } from "react";
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
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrencyNOK, formatDate } from "@/lib/utils";
import { GripVertical, Loader2, Plus, User } from "lucide-react";

export interface PipelineStage {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface TenantMember {
  user_id: string;
  full_name: string | null;
  email: string;
}

export interface PipelineCard {
  id: string;
  stage_id: string;
  sort_order: number;
  notes: string | null;
  assigned_to: string | null;
  title: string | null;
  value_nok: number | null;
  project: {
    id: string;
    title: string;
    description: string;
    budget_min_nok: number | null;
    budget_max_nok: number | null;
    status: string;
    created_at: string;
  } | null;
  contact: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    lifecycle_stage: string;
  } | null;
  latest_bid: {
    amount_nok: number;
    status: string;
  } | null;
}

export function cardTitle(card: PipelineCard): string {
  if (card.project) return card.project.title;
  if (card.contact) {
    return (
      card.contact.full_name ??
      card.contact.company ??
      card.contact.email ??
      card.contact.phone ??
      "Lead"
    );
  }
  return card.title ?? "Lead";
}

export function PipelineBoard({
  stages,
  cards,
  members,
}: {
  stages: PipelineStage[];
  cards: PipelineCard[];
  members: TenantMember[];
}) {
  const router = useRouter();
  const [localCards, setLocalCards] = useState(cards);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [detailCard, setDetailCard] = useState<PipelineCard | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const cardsByStage = useMemo(() => {
    const map = new Map<string, PipelineCard[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const card of localCards) {
      const arr = map.get(card.stage_id);
      if (arr) arr.push(card);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [stages, localCards]);

  function onDragStart(event: DragStartEvent) {
    setActiveCardId(String(event.active.id));
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveCardId(null);
    const cardId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) return;

    const card = localCards.find((c) => c.id === cardId);
    if (!card) return;

    // overId is a stage_id (we make columns droppable)
    if (card.stage_id === overId) return;

    // Optimistic update
    setLocalCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, stage_id: overId } : c)),
    );

    const res = await fetch(`/api/pipeline/cards/${cardId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage_id: overId }),
    });
    if (!res.ok) {
      // Revert on error
      setLocalCards((prev) =>
        prev.map((c) =>
          c.id === cardId ? { ...c, stage_id: card.stage_id } : c,
        ),
      );
    }
  }

  async function updateCard(
    cardId: string,
    patch: { assigned_to?: string | null; notes?: string | null },
  ) {
    setLocalCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
    );
    await fetch(`/api/pipeline/cards/${cardId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    router.refresh();
  }

  // Totals for header — only "open" cards (not won/lost stages)
  const closedStageIds = new Set(
    stages.filter((s) => s.is_won || s.is_lost).map((s) => s.id),
  );
  const openCards = localCards.filter((c) => !closedStageIds.has(c.stage_id));
  const wonCards = localCards.filter((c) => {
    const s = stages.find((st) => st.id === c.stage_id);
    return s?.is_won;
  });
  const openValue = openCards.reduce(
    (sum, c) => sum + (c.latest_bid?.amount_nok ?? c.value_nok ?? 0),
    0,
  );
  const wonValue = wonCards.reduce(
    (sum, c) => sum + (c.latest_bid?.amount_nok ?? c.value_nok ?? 0),
    0,
  );

  return (
    <>
      {/* Header — stays in place while board scrolls horizontally */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pipeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {openCards.length}
            </span>{" "}
            åpne
            {openValue > 0 ? (
              <>
                {" "}
                ·{" "}
                <span className="font-medium text-foreground">
                  {formatCurrencyNOK(openValue)}
                </span>{" "}
                i pipeline
              </>
            ) : null}
            {wonCards.length > 0 ? (
              <>
                {" "}
                ·{" "}
                <span className="font-medium text-brand">
                  {wonCards.length} vunnet
                </span>
                {wonValue > 0 ? ` (${formatCurrencyNOK(wonValue)})` : ""}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="brand" size="default" onClick={() => setShowNewLead(true)}>
            <Plus className="h-4 w-4" /> Ny lead
          </Button>
        </div>
      </div>

      {/* Board — self-contained horizontal + vertical scroll */}
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-4">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              cards={cardsByStage.get(stage.id) ?? []}
              members={members}
              onCardClick={setDetailCard}
            />
          ))}
        </div>
        <DragOverlay>
          {activeCardId
            ? (() => {
                const card = localCards.find((c) => c.id === activeCardId);
                return card ? <CardChip card={card} dragging /> : null;
              })()
            : null}
        </DragOverlay>
      </DndContext>

      <Dialog
        open={detailCard !== null}
        onOpenChange={(open) => {
          if (!open) setDetailCard(null);
        }}
        className="max-w-xl"
      >
        {detailCard ? (
          <CardDetail
            card={detailCard}
            members={members}
            onUpdate={(patch) => updateCard(detailCard.id, patch)}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={showNewLead}
        onOpenChange={(open) => setShowNewLead(open)}
        className="max-w-lg"
      >
        <NewLeadForm
          onCancel={() => setShowNewLead(false)}
          onCreated={() => {
            setShowNewLead(false);
            router.refresh();
          }}
        />
      </Dialog>
    </>
  );
}

function NewLeadForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [valueNok, setValueNok] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName && !email && !phone) {
      setError("Oppgi minst navn, e-post eller telefon.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: fullName || undefined,
          email: email || undefined,
          phone: phone || undefined,
          company: company || undefined,
          notes: notes || undefined,
          lifecycle_stage: "lead",
          create_pipeline_card: true,
          value_nok: valueNok ? parseInt(valueNok, 10) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Kunne ikke opprette lead");
        return;
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <DialogTitle>Ny lead</DialogTitle>
        <DialogDescription>
          Oppretter en kontakt i adresseboken og legger et kort i første stadium.
        </DialogDescription>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nl-name">Navn</Label>
          <Input
            id="nl-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nl-company">Selskap</Label>
          <Input
            id="nl-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nl-email">E-post</Label>
          <Input
            id="nl-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nl-phone">Telefon</Label>
          <Input
            id="nl-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="nl-value">Forventet verdi (NOK, valgfritt)</Label>
        <Input
          id="nl-value"
          type="number"
          min={0}
          value={valueNok}
          onChange={(e) => setValueNok(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nl-notes">Notater</Label>
        <Textarea
          id="nl-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Avbryt
        </Button>
        <Button type="submit" variant="brand" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Oppretter…
            </>
          ) : (
            "Opprett lead"
          )}
        </Button>
      </div>
    </form>
  );
}

function StageColumn({
  stage,
  cards,
  members,
  onCardClick,
}: {
  stage: PipelineStage;
  cards: PipelineCard[];
  members: TenantMember[];
  onCardClick: (card: PipelineCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = cards.reduce(
    (sum, c) => sum + (c.latest_bid?.amount_nok ?? 0),
    0,
  );
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-72 shrink-0 flex-col rounded-lg border bg-card transition-colors",
        isOver ? "border-brand bg-brand/5" : "border-border",
      )}
    >
      {/* Column header — sticky within column */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: stage.color ?? "#94a3b8" }}
          />
          <span className="text-sm font-semibold">{stage.name}</span>
          <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
            {cards.length}
          </span>
        </div>
        {total > 0 ? (
          <span className="text-[11px] font-medium text-muted-foreground">
            {formatCurrencyNOK(total)}
          </span>
        ) : null}
      </div>

      {/* Cards — scroll internally when many */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 p-3">
          {cards.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Dra kort hit
            </div>
          ) : (
            cards.map((card) => (
              <DraggableCard
                key={card.id}
                card={card}
                members={members}
                onClick={() => onCardClick(card)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DraggableCard({
  card,
  members,
  onClick,
}: {
  card: PipelineCard;
  members: TenantMember[];
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
  });
  const assignee = members.find((m) => m.user_id === card.assigned_to);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group rounded-md border border-border bg-background p-3 text-sm shadow-sm transition-shadow",
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
        <button
          type="button"
          className="flex-1 text-left"
          onClick={onClick}
        >
          <div className="font-medium">{cardTitle(card)}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {card.contact && !card.project ? (
              <Badge variant="outline" className="text-[10px]">Egen</Badge>
            ) : null}
            {card.latest_bid ? (
              <Badge variant="outline" className="font-mono">
                {formatCurrencyNOK(card.latest_bid.amount_nok)}
              </Badge>
            ) : card.project?.budget_min_nok ? (
              <span>Fra {formatCurrencyNOK(card.project.budget_min_nok)}</span>
            ) : card.value_nok ? (
              <span>{formatCurrencyNOK(card.value_nok)}</span>
            ) : null}
            {assignee ? (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                {assignee.full_name ?? assignee.email.split("@")[0]}
              </span>
            ) : null}
          </div>
        </button>
      </div>
    </div>
  );
}

function CardChip({
  card,
  dragging,
}: {
  card: PipelineCard;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-72 rounded-md border border-border bg-background p-3 text-sm shadow-lg",
        dragging && "rotate-2",
      )}
    >
      <div className="font-medium">{cardTitle(card)}</div>
      {card.latest_bid ? (
        <div className="mt-1 text-xs text-muted-foreground">
          {formatCurrencyNOK(card.latest_bid.amount_nok)}
        </div>
      ) : card.value_nok ? (
        <div className="mt-1 text-xs text-muted-foreground">
          {formatCurrencyNOK(card.value_nok)}
        </div>
      ) : null}
    </div>
  );
}

function CardDetail({
  card,
  members,
  onUpdate,
}: {
  card: PipelineCard;
  members: TenantMember[];
  onUpdate: (patch: {
    assigned_to?: string | null;
    notes?: string | null;
  }) => Promise<void>;
}) {
  const [notes, setNotes] = useState(card.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [assignedTo, setAssignedTo] = useState(card.assigned_to);

  async function saveNotes() {
    setSavingNotes(true);
    await onUpdate({ notes: notes || null });
    setSavingNotes(false);
  }

  async function changeAssignee(userId: string | null) {
    setAssignedTo(userId);
    await onUpdate({ assigned_to: userId });
  }

  return (
    <div className="space-y-4">
      <div>
        <DialogTitle>{cardTitle(card)}</DialogTitle>
        <DialogDescription>
          {card.project
            ? `Opprettet ${formatDate(card.project.created_at)} · Status ${card.project.status}`
            : card.contact
              ? `Egen kontakt · ${card.contact.lifecycle_stage}`
              : "Manuell lead"}
        </DialogDescription>
      </div>

      {card.project ? (
        <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
          <p className="line-clamp-6 whitespace-pre-wrap">
            {card.project.description}
          </p>
          <a
            href={`/byraa/leads/${card.project.id}`}
            className="mt-2 inline-block text-xs text-brand underline-offset-2 hover:underline"
          >
            Åpne full lead →
          </a>
        </div>
      ) : card.contact ? (
        <div className="space-y-1 rounded-md border border-border p-3 text-sm">
          {card.contact.email ? <div>📧 {card.contact.email}</div> : null}
          {card.contact.phone ? <div>📞 {card.contact.phone}</div> : null}
          {card.contact.company ? <div>🏢 {card.contact.company}</div> : null}
          <a
            href={`/byraa/kontakter`}
            className="mt-2 inline-block text-xs text-brand underline-offset-2 hover:underline"
          >
            Åpne kontakten →
          </a>
        </div>
      ) : null}

      {card.latest_bid ? (
        <div className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
          <span className="text-muted-foreground">Ditt tilbud:</span>
          <span className="font-semibold">
            {formatCurrencyNOK(card.latest_bid.amount_nok)}
          </span>
          <Badge variant="outline">{card.latest_bid.status}</Badge>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tildelt
        </label>
        <select
          value={assignedTo ?? ""}
          onChange={(e) => changeAssignee(e.target.value || null)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Ingen</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name ?? m.email}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Interne notater
        </label>
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Kun ditt team ser disse. F.eks. hva som ble sagt på oppfølgingssamtale."
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={savingNotes || notes === (card.notes ?? "")}
            onClick={saveNotes}
          >
            {savingNotes ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Lagrer…
              </>
            ) : (
              "Lagre notater"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
