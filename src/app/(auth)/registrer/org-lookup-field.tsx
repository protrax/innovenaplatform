"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Search } from "lucide-react";
import { LAND, type LandKode } from "@/lib/foretaksregister";

export type OrgHit = {
  orgnr: string;
  land: LandKode;
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
 * «TBD» og «Har ikke for tiden». Her kommer navnet fra registeret, ikke fra
 * brukeren — og konkurs/avvikling stoppes før de kommer inn i katalogen.
 * Det er samtidig mindre å skrive: et tall i stedet for fire felter.
 *
 * Feltet krevde tidligere ni siffer, altså et norsk organisasjonsnummer. Det
 * stengte ute nordiske byråer som jobber mot det norske markedet. Nå velger
 * man land først: Norge slås opp i Enhetsregisteret, Sverige i EUs
 * momsregister.
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
  const [land, setLand] = useState<LandKode>("NO");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const konfig = LAND[land];
  const klart = input.replace(/\D/g, "").length === konfig.siffer;

  async function lookup() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/org-lookup?orgnr=${encodeURIComponent(input)}&land=${land}`,
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Oppslaget feilet.");
        return;
      }
      onResolved(body as OrgHit);
    } catch {
      setError(`Kunne ikke nå ${konfig.register}. Prøv igjen om litt.`);
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
                {value.land !== "NO" ? ` · ${LAND[value.land].navn}` : ""}
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
        <select
          aria-label="Land"
          value={land}
          onChange={(e) => {
            setLand(e.target.value as LandKode);
            setInput("");
            setError(null);
          }}
          className="h-9 shrink-0 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {Object.values(LAND).map((l) => (
            <option key={l.kode} value={l.kode}>
              {l.navn}
            </option>
          ))}
        </select>
        <Input
          id="orgnr"
          inputMode="numeric"
          placeholder={konfig.plassholder}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (klart) lookup();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={lookup}
          disabled={busy || !klart}
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
          Vi henter foretaksnavnet fra {konfig.register}, så du slipper å fylle
          ut selskapsinfo selv.
        </p>
      )}
    </div>
  );
}
