"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Search } from "lucide-react";

export type OrgHit = {
  orgnr: string;
  name: string;
  formLabel: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
};

/**
 * Organisasjonsnummer med oppslag mot Enhetsregisteret.
 *
 * Erstatter et fritt «firmanavn»-felt som ga oss registreringer med navnet
 * «TBD» og «Har ikke for tiden». Her kommer navnet fra Brønnøysund, ikke fra
 * brukeren — og konkurs/avvikling stoppes før de kommer inn i katalogen.
 * Det er samtidig mindre å skrive: ni siffer i stedet for fire felter.
 */
export function OrgLookupField({
  value,
  onResolved,
  onCleared,
}: {
  value: OrgHit | null;
  onResolved: (hit: OrgHit) => void;
  onCleared: () => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/org-lookup?orgnr=${encodeURIComponent(input)}`,
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Oppslaget feilet.");
        return;
      }
      onResolved(body as OrgHit);
    } catch {
      setError("Kunne ikke nå Enhetsregisteret. Prøv igjen om litt.");
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <div className="space-y-2">
        <Label>Foretak</Label>
        <div className="rounded-md border border-brand/50 bg-brand/5 p-3">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div className="min-w-0 text-sm">
              <div className="font-medium">{value.name}</div>
              <div className="text-xs text-muted-foreground">
                Org.nr {value.orgnr}
                {value.formLabel ? ` · ${value.formLabel}` : ""}
                {value.location ? ` · ${value.location}` : ""}
              </div>
              {value.industry ? (
                <div className="text-xs text-muted-foreground">
                  {value.industry}
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setInput("");
              onCleared();
            }}
            className="mt-2 text-xs underline underline-offset-2 text-muted-foreground"
          >
            Feil foretak? Søk på nytt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="orgnr">Organisasjonsnummer</Label>
      <div className="flex gap-2">
        <Input
          id="orgnr"
          inputMode="numeric"
          placeholder="9 siffer"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (input.replace(/\D/g, "").length === 9) lookup();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={lookup}
          disabled={busy || input.replace(/\D/g, "").length !== 9}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Hent
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Vi henter foretaksnavnet fra Enhetsregisteret, så du slipper å fylle
          ut selskapsinfo selv.
        </p>
      )}
    </div>
  );
}
