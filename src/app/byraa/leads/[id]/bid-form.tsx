"use client";

import { useState } from "react";
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
import { formatCurrencyNOK } from "@/lib/utils";
import { Loader2, Sparkles, Send, Plus, X } from "lucide-react";

interface ExistingBid {
  id: string;
  status: string;
  amount_nok: number;
  delivery_weeks: number | null;
  summary: string | null;
  description: string;
  includes: string[] | null;
}

export function BidForm({
  projectId,
  existing,
  aiEnabled,
}: {
  projectId: string;
  existing: ExistingBid | null;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    existing?.amount_nok ? String(existing.amount_nok) : "",
  );
  const [deliveryWeeks, setDeliveryWeeks] = useState(
    existing?.delivery_weeks ? String(existing.delivery_weeks) : "",
  );
  const [keyPoints, setKeyPoints] = useState("");
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [includes, setIncludes] = useState<string[]>(existing?.includes ?? []);
  const [newInclude, setNewInclude] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, setBidId] = useState<string | null>(existing?.id ?? null);
  const isAlreadyAnswered =
    existing?.status === "accepted" || existing?.status === "rejected";

  async function generateText() {
    if (!amount || !keyPoints.trim()) {
      setError("Fyll inn pris og noen nøkkelpunkter før AI kan hjelpe");
      return;
    }
    setError(null);
    setLoading(true);
    setLoadingMessage("Skriver tilbudsteksten…");
    try {
      const res = await fetch("/api/wizard/generate-offer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          amount: Number(amount),
          delivery_weeks: deliveryWeeks ? Number(deliveryWeeks) : null,
          key_points: keyPoints,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Kunne ikke generere tekst");
      setSummary(body.summary);
      setDescription(body.description_markdown);
      setIncludes(body.includes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  async function saveDraft() {
    if (!amount || !summary.trim() || !description.trim()) {
      setError("Fyll ut pris, sammendrag og beskrivelse");
      return null;
    }
    setError(null);
    setLoading(true);
    setLoadingMessage("Lagrer…");
    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          amount_nok: Number(amount),
          delivery_weeks: deliveryWeeks ? Number(deliveryWeeks) : null,
          summary,
          description,
          includes,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Kunne ikke lagre");
      setBidId(body.bid.id);
      return body.bid.id as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
      return null;
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  async function send() {
    const id = await saveDraft();
    if (!id) return;
    setLoading(true);
    setLoadingMessage("Sender til kunden…");
    try {
      const res = await fetch(`/api/bids/${id}/send`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Kunne ikke sende");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  function addInclude() {
    const trimmed = newInclude.trim();
    if (!trimmed) return;
    setIncludes([...includes, trimmed]);
    setNewInclude("");
  }

  function removeInclude(i: number) {
    setIncludes(includes.filter((_, idx) => idx !== i));
  }

  const isSent =
    existing?.status === "sent" ||
    existing?.status === "viewed" ||
    existing?.status === "accepted" ||
    existing?.status === "rejected";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Ditt tilbud</CardTitle>
            <CardDescription>
              {isAlreadyAnswered
                ? `Tilbudet er ${existing?.status === "accepted" ? "akseptert" : "avslått"}.`
                : isSent
                  ? "Tilbudet er sendt og venter på svar fra kunden."
                  : "Fyll ut og send. La AI-en hjelpe deg skrive noe kunden forstår."}
            </CardDescription>
          </div>
          {existing?.status ? (
            <Badge
              variant={
                existing.status === "accepted"
                  ? "brand"
                  : existing.status === "rejected"
                    ? "destructive"
                    : "outline"
              }
            >
              {existing.status}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!isSent ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bid-amount">Pris (NOK eks. mva)</Label>
                <Input
                  id="bid-amount"
                  type="number"
                  min={100}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="F.eks. 95000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bid-weeks">Leveringstid (uker)</Label>
                <Input
                  id="bid-weeks"
                  type="number"
                  min={1}
                  max={260}
                  value={deliveryWeeks}
                  onChange={(e) => setDeliveryWeeks(e.target.value)}
                  placeholder="F.eks. 4"
                />
              </div>
            </div>

            {aiEnabled ? (
              <div className="rounded-md border border-border bg-card p-4 space-y-3">
                <div>
                  <Label htmlFor="bid-keypoints" className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand" /> La AI-en skrive
                    tilbudet for deg
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Skriv noen nøkkelpunkter om hva du vil tilby. AI-en lager
                    profesjonell, kundevennlig tekst du kan redigere fritt.
                  </p>
                </div>
                <Textarea
                  id="bid-keypoints"
                  rows={4}
                  placeholder="F.eks. Responsivt design i Figma + Webflow, CMS som kunden kan bruke selv, integrasjon med bookingsystem, 2 rundet tilbakemelding, opplæring."
                  value={keyPoints}
                  onChange={(e) => setKeyPoints(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateText}
                  disabled={loading || !amount || !keyPoints.trim()}
                >
                  {loading && loadingMessage.includes("skriver") ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> {loadingMessage}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Foreslå tilbudstekst
                    </>
                  )}
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="bid-summary">Kort sammendrag (vises først)</Label>
              <Input
                id="bid-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="1–2 setninger som fanger kjernen"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bid-description">Full beskrivelse</Label>
              <Textarea
                id="bid-description"
                rows={10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beskriv leveranse, prosess, forventinger til kunden…"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Støtter markdown. Kunden ser dette som formatert tekst.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Hva er inkludert (punktvis)</Label>
              <ul className="space-y-1">
                {includes.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="flex-1">{item}</span>
                    <button
                      type="button"
                      onClick={() => removeInclude(i)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Fjern"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  value={newInclude}
                  onChange={(e) => setNewInclude(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInclude();
                    }
                  }}
                  placeholder="Legg til et punkt og trykk Enter"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addInclude}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-muted-foreground">
                {amount
                  ? `Foreslått pris: ${formatCurrencyNOK(Number(amount))}`
                  : "Pris ikke satt"}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveDraft}
                  disabled={loading}
                >
                  Lagre kladd
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  onClick={send}
                  disabled={loading}
                >
                  {loading && loadingMessage.includes("Send") ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> {loadingMessage}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Send tilbud til kunde
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3 rounded-md border border-border p-4 text-sm">
            <div>
              <span className="text-muted-foreground">Pris: </span>
              <span className="font-semibold">
                {formatCurrencyNOK(existing?.amount_nok ?? 0)}
              </span>
            </div>
            {existing?.delivery_weeks ? (
              <div>
                <span className="text-muted-foreground">Leveringstid: </span>
                {existing.delivery_weeks} uker
              </div>
            ) : null}
            {existing?.summary ? (
              <div>
                <div className="text-xs text-muted-foreground">Sammendrag</div>
                <p>{existing.summary}</p>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
