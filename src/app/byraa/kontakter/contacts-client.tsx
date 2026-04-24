"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatDate, cn } from "@/lib/utils";
import { Loader2, Plus, Mail, Phone, Trash2 } from "lucide-react";

type LifecycleStage = "subscriber" | "lead" | "customer" | "lost";

interface Contact {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  tags: string[];
  notes: string | null;
  source: string | null;
  lifecycle_stage: LifecycleStage;
  created_at: string;
}

const STAGE_LABELS: Record<LifecycleStage, string> = {
  subscriber: "Abonnent",
  lead: "Lead",
  customer: "Kunde",
  lost: "Tapt",
};

const STAGE_FILTERS: { value: "all" | LifecycleStage; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "lead", label: "Leads" },
  { value: "customer", label: "Kunder" },
  { value: "subscriber", label: "Abonnenter" },
  { value: "lost", label: "Tapt" },
];

export function ContactsClient({
  initialContacts,
}: {
  initialContacts: Contact[];
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | LifecycleStage>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filter !== "all" && c.lifecycle_stage !== filter) return false;
      if (!q) return true;
      return (
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.company?.toLowerCase().includes(q)
      );
    });
  }, [contacts, query, filter]);

  async function handleDelete(id: string) {
    if (!confirm("Slette kontakten? Dette kan ikke angres.")) return;
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Søk navn, e-post, selskap…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-1">
          {STAGE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs transition-colors",
                filter === f.value
                  ? "border-brand bg-brand/5"
                  : "border-border hover:border-foreground/30",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Button variant="brand" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Ny kontakt
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen kontakter</CardTitle>
            <CardDescription>
              Legg til manuelt, eller koble et skjema på nettsiden deres —
              se fanen Innstillinger → Webhook.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {filtered.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-3 p-4"
                >
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => setEditing(c)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {c.full_name ?? c.email ?? c.phone ?? "(uten navn)"}
                      </span>
                      <Badge
                        variant={
                          c.lifecycle_stage === "customer" ? "brand" : "outline"
                        }
                        className="text-[10px]"
                      >
                        {STAGE_LABELS[c.lifecycle_stage]}
                      </Badge>
                      {c.source ? (
                        <span className="text-[10px] text-muted-foreground">
                          · {c.source}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {c.email ? (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </span>
                      ) : null}
                      {c.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </span>
                      ) : null}
                      {c.company ? <span>· {c.company}</span> : null}
                      <span>· {formatDate(c.created_at)}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    aria-label="Slett"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={showCreate}
        onOpenChange={(open) => setShowCreate(open)}
        className="max-w-lg"
      >
        <ContactForm
          onCancel={() => setShowCreate(false)}
          onSaved={(c) => {
            setContacts((prev) => [c, ...prev]);
            setShowCreate(false);
            router.refresh();
          }}
        />
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        className="max-w-lg"
      >
        {editing ? (
          <ContactForm
            contact={editing}
            onCancel={() => setEditing(null)}
            onSaved={(updated) => {
              setContacts((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c)),
              );
              setEditing(null);
              router.refresh();
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function ContactForm({
  contact,
  onCancel,
  onSaved,
}: {
  contact?: Contact;
  onCancel: () => void;
  onSaved: (contact: Contact) => void;
}) {
  const isEdit = contact !== undefined;
  const [fullName, setFullName] = useState(contact?.full_name ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [company, setCompany] = useState(contact?.company ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [stage, setStage] = useState<LifecycleStage>(
    contact?.lifecycle_stage ?? "lead",
  );
  const [addToPipeline, setAddToPipeline] = useState(!isEdit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = {
        full_name: fullName || null,
        email: email || null,
        phone: phone || null,
        company: company || null,
        notes: notes || null,
        lifecycle_stage: stage,
        ...(isEdit ? {} : { create_pipeline_card: addToPipeline }),
      };
      const res = isEdit
        ? await fetch(`/api/contacts/${contact!.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/contacts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "Kunne ikke lagre");
        return;
      }
      onSaved({
        id: isEdit ? contact!.id : result.id,
        full_name: fullName || null,
        email: email || null,
        phone: phone || null,
        company: company || null,
        notes: notes || null,
        tags: contact?.tags ?? [],
        source: contact?.source ?? "manual",
        lifecycle_stage: stage,
        created_at: contact?.created_at ?? new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <DialogTitle>{isEdit ? "Rediger kontakt" : "Ny kontakt"}</DialogTitle>
        <DialogDescription>
          Oppgi minst navn, e-post eller telefon.
        </DialogDescription>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Navn</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Selskap</Label>
          <Input
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-post</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="stage">Livsløpsstadium</Label>
        <select
          id="stage"
          value={stage}
          onChange={(e) => setStage(e.target.value as LifecycleStage)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="lead">Lead</option>
          <option value="customer">Kunde</option>
          <option value="subscriber">Abonnent</option>
          <option value="lost">Tapt</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notater</Label>
        <Textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {!isEdit ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={addToPipeline}
            onChange={(e) => setAddToPipeline(e.target.checked)}
          />
          Legg inn i pipelinen som nytt kort
        </label>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Avbryt
        </Button>
        <Button type="submit" variant="brand" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Lagrer…
            </>
          ) : isEdit ? (
            "Oppdater"
          ) : (
            "Opprett"
          )}
        </Button>
      </div>
    </form>
  );
}
