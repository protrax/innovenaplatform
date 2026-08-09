"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";

/**
 * Sender en testmail til admins egen adresse via /api/admin/email-status.
 * Finnes fordi e-postfeil er stille: sendingen skjer etter at svaret er
 * returnert, og feil havner bare i loggen. Uten en knapp her måtte man inn i
 * Resend for å vite om varslene faktisk går ut.
 */
export function EmailSelfTest() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/email-status", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setResult(body.error ?? "Testsending feilet.");
      } else {
        setResult(
          "Testmail sendt til din egen adresse. Kommer den ikke innen et minutt, sjekk søppelpost — og deretter Resend.",
        );
      }
    } catch {
      setResult("Kunne ikke kontakte serveren.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <Button variant="outline" size="sm" onClick={run} disabled={busy}>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Send testmail til meg selv
      </Button>
      {result ? (
        <span className="text-xs text-muted-foreground">{result}</span>
      ) : null}
    </div>
  );
}
