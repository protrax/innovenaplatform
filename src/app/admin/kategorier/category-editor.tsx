"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ServiceCategory } from "@/lib/supabase/types";

/** Samme grenser som API-et validerer mot — holdt i synk med vilje. */
const MIN_AGENCIES = 1;
const MAX_AGENCIES = 10;
/** Løftet vi gir kunden på nettsidene. Over dette advarer vi i UI-et. */
const PROMISED_MAX = 5;

type Draft = {
  name: string;
  sort_order: string;
  max_agencies_per_lead: string;
  active: boolean;
};

function toDraft(c: ServiceCategory): Draft {
  return {
    name: c.name,
    sort_order: String(c.sort_order),
    max_agencies_per_lead: String(c.max_agencies_per_lead),
    active: c.active,
  };
}

export function CategoryEditor({
  categories,
}: {
  categories: ServiceCategory[];
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kategorier ({categories.length})</CardTitle>
          <CardDescription>
            Rediger navn, sortering, status og distribusjonstak direkte i
            tabellen. Endringer lagres når du forlater feltet, eller med
            Lagre-knappen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              Maks byråer per lead
            </p>
            <p className="mt-1">
              Tallet er hvor mange byråer som maks får den samme forespørselen i
              denne kategorien. Vi lover kundene «maks fem tilbud», så sett
              tallet høyere enn 5 bare hvis du bevisst vil fravike det løftet.
              Gratis-byråer kan uansett ta høyst to av plassene — resten er
              forbeholdt betalende byråer. Tillatt område er {MIN_AGENCIES}–
              {MAX_AGENCIES}.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Ingen sletting</p>
            <p className="mt-1">
              Kategorier henger sammen med byråenes kategorivalg
              (tenant_categories) og gamle forespørsler (project_categories). En
              sletting ville dratt med seg den historikken. Sett kategorien til
              inaktiv i stedet: da forsvinner den fra skjema og matching, men
              alt som allerede er registrert består.
            </p>
          </div>

          <ul className="divide-y divide-border">
            {categories.map((category) => (
              <CategoryRow key={category.id} category={category} />
            ))}
          </ul>
          {categories.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Ingen kategorier ennå. Opprett den første nedenfor.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <NewCategoryForm />
    </div>
  );
}

function CategoryRow({ category }: { category: ServiceCategory }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(category));
  const [saved, setSaved] = useState<Draft>(() => toDraft(category));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    draft.name !== saved.name ||
    draft.sort_order !== saved.sort_order ||
    draft.max_agencies_per_lead !== saved.max_agencies_per_lead ||
    draft.active !== saved.active;

  const maxAgencies = Number(draft.max_agencies_per_lead);
  const maxAgenciesValid =
    Number.isInteger(maxAgencies) &&
    maxAgencies >= MIN_AGENCIES &&
    maxAgencies <= MAX_AGENCIES;
  const sortOrder = Number(draft.sort_order);
  const sortOrderValid = Number.isInteger(sortOrder) && sortOrder >= 0;
  const nameValid = draft.name.trim().length >= 2;
  const valid = maxAgenciesValid && sortOrderValid && nameValid;

  async function save(next: Draft) {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/categories/${category.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: next.name.trim(),
        sort_order: Number(next.sort_order),
        max_agencies_per_lead: Number(next.max_agencies_per_lead),
        active: next.active,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Kunne ikke lagre");
      return;
    }
    setSaved(next);
    router.refresh();
  }

  /** Lagre på blur, men bare når noe faktisk er endret og gyldig. */
  function saveOnBlur() {
    if (dirty && valid) void save(draft);
  }

  function toggleActive() {
    const next = { ...draft, active: !draft.active };
    setDraft(next);
    if (valid) void save(next);
  }

  return (
    <li className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_5rem_7rem_auto] md:items-end">
      <div className="space-y-1">
        <Label htmlFor={`name-${category.id}`} className="text-xs">
          Navn
        </Label>
        <Input
          id={`name-${category.id}`}
          value={draft.name}
          disabled={saving}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onBlur={saveOnBlur}
        />
        <p className="text-xs text-muted-foreground">
          <code>{category.slug}</code> — slug kan ikke endres, den brukes i
          URL-er og av byråenes eksisterende kategorivalg.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`sort-${category.id}`} className="text-xs">
          Sortering
        </Label>
        <Input
          id={`sort-${category.id}`}
          type="number"
          min={0}
          value={draft.sort_order}
          disabled={saving}
          onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })}
          onBlur={saveOnBlur}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`max-${category.id}`} className="text-xs">
          Maks byråer
        </Label>
        <Input
          id={`max-${category.id}`}
          type="number"
          min={MIN_AGENCIES}
          max={MAX_AGENCIES}
          value={draft.max_agencies_per_lead}
          disabled={saving}
          aria-invalid={!maxAgenciesValid}
          onChange={(e) =>
            setDraft({ ...draft, max_agencies_per_lead: e.target.value })
          }
          onBlur={saveOnBlur}
        />
        {!maxAgenciesValid ? (
          <p className="text-xs text-destructive">
            Må være mellom {MIN_AGENCIES} og {MAX_AGENCIES}
          </p>
        ) : maxAgencies > PROMISED_MAX ? (
          <p className="text-xs text-muted-foreground">
            Over løftet om maks {PROMISED_MAX}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={draft.active ? "brand" : "outline"}
          disabled={saving}
          aria-pressed={draft.active}
          onClick={toggleActive}
        >
          {draft.active ? "Aktiv" : "Inaktiv"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving || !dirty || !valid}
          onClick={() => void save(draft)}
        >
          {saving ? "Lagrer…" : dirty ? "Lagre" : "Lagret"}
        </Button>
        {error ? (
          <Badge variant="outline" className="text-destructive">
            {error}
          </Badge>
        ) : null}
      </div>
    </li>
  );
}

function NewCategoryForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [maxAgencies, setMaxAgencies] = useState("5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        sort_order: Number(sortOrder) || 0,
        max_agencies_per_lead: Number(maxAgencies),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Kunne ikke opprette kategorien");
      return;
    }
    setSlug("");
    setName("");
    setDescription("");
    setSortOrder("0");
    setMaxAgencies("5");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ny kategori</CardTitle>
        <CardDescription>
          Slug må være små bokstaver og tall delt med bindestrek, for eksempel{" "}
          <code>web-design</code>. Den låses etter opprettelsen fordi den brukes
          i URL-er.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="new-name">Navn</Label>
              <Input
                id="new-name"
                required
                minLength={2}
                value={name}
                disabled={saving}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-slug">Slug</Label>
              <Input
                id="new-slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={slug}
                disabled={saving}
                placeholder="web-design"
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="new-description">Beskrivelse (valgfritt)</Label>
            <Input
              id="new-description"
              value={description}
              disabled={saving}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="new-sort">Sortering</Label>
              <Input
                id="new-sort"
                type="number"
                min={0}
                value={sortOrder}
                disabled={saving}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-max">Maks byråer per lead</Label>
              <Input
                id="new-max"
                type="number"
                min={MIN_AGENCIES}
                max={MAX_AGENCIES}
                value={maxAgencies}
                disabled={saving}
                onChange={(e) => setMaxAgencies(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Antall byråer som maks får samme forespørsel. Vi lover kundene
                maks {PROMISED_MAX}; gratis-byråer tar høyst to av plassene.
              </p>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" variant="brand" disabled={saving}>
            {saving ? "Oppretter…" : "Opprett kategori"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
