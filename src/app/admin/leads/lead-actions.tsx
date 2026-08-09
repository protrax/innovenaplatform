"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

/**
 * Handlinger admin trenger på en forespørsel. Uten disse måtte admin inn i
 * databasen for å rydde testdata, og en forespørsel som kom inn da ingen byrå
 * matchet ble liggende ufordelt for alltid.
 */
export function LeadActions({
  projectId,
  title,
  distributedCount,
}: {
  projectId: string;
  title: string;
  distributedCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"redistribute" | "delete" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Bekreftelse i selve knappen. window.confirm() fryser renderen mens den
  // står åpen, kan ikke styles, og oppfører seg ulikt på tvers av nettlesere —
  // dårlig i et verktøy admin bruker daglig.
  const [confirming, setConfirming] = useState(false);

  async function redistribute() {
    setBusy("redistribute");
    setNote(null);
    try {
      const res = await fetch(
        `/api/admin/projects/${projectId}/redistribute`,
        { method: "POST" },
      );
      const body = await res.json();
      setNote(body.message ?? body.error ?? "Ukjent svar");
      if (res.ok) router.refresh();
    } catch {
      setNote("Kunne ikke kontakte serveren. Prøv igjen.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setConfirming(false);
    setBusy("delete");
    setNote(null);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const body = await res.json();
      setNote(body.error ?? "Sletting feilet");
    } catch {
      setNote("Kunne ikke kontakte serveren. Prøv igjen.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <Button
        variant="outline"
        size="sm"
        onClick={redistribute}
        disabled={busy !== null}
      >
        {busy === "redistribute" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {distributedCount > 0 ? "Send til flere byrå" : "Fordel til byrå"}
      </Button>
      {confirming ? (
        <>
          <span className="text-xs text-destructive">
            Slette «{title.slice(0, 40)}
            {title.length > 40 ? "…" : ""}» permanent? Fordeling, tilbud og
            meldinger forsvinner.
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={remove}
            disabled={busy !== null}
          >
            {busy === "delete" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Ja, slett
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
            disabled={busy !== null}
          >
            Avbryt
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(true)}
          disabled={busy !== null}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Slett
        </Button>
      )}
      {note ? (
        <span className="text-xs text-muted-foreground">{note}</span>
      ) : null}
    </div>
  );
}
