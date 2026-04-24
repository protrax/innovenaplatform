"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { formatCurrencyNOK } from "@/lib/utils";

type Mode = "idle" | "accepting" | "rejecting";

export function BidResponseActions({
  bidId,
  amountNok,
  tenantName,
}: {
  bidId: string;
  amountNok: number;
  tenantName: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "accept" | "reject") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bids/${bidId}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          reason: action === "reject" ? reason : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Ukjent feil");
      if (action === "accept" && body.contract_id) {
        router.push(`/kontrakter/${body.contract_id}?signed=1`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
      setLoading(false);
    }
  }

  if (mode === "accepting") {
    return (
      <Card className="border-brand/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand" />
            Bekreft aksept av tilbudet
          </CardTitle>
          <CardDescription>
            Ved å akseptere signerer du avtalen elektronisk. Du og {tenantName}{" "}
            får hver sin kopi av kontrakten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-card p-4 text-sm">
            <div className="font-medium">Du aksepterer:</div>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>
                • Avtalen med <span className="text-foreground">{tenantName}</span>
              </li>
              <li>
                • Avtalt pris:{" "}
                <span className="text-foreground">
                  {formatCurrencyNOK(amountNok)} eks. mva
                </span>
              </li>
              <li>• Innovena sine standardvilkår (vises i kontrakten)</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Elektronisk aksept er juridisk bindende i henhold til norsk lov om
            elektroniske tillitstjenester. IP-adressen og tidspunktet loggføres
            som en del av signaturen.
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setMode("idle")}
              disabled={loading}
            >
              Avbryt
            </Button>
            <Button
              variant="brand"
              onClick={() => submit("accept")}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signerer…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Jeg aksepterer og signerer
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === "rejecting") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Avslå tilbudet</CardTitle>
          <CardDescription>
            Gi gjerne en kort begrunnelse — det hjelper {tenantName} å lære.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="F.eks. For høy pris for vårt budsjett"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setMode("idle")}
              disabled={loading}
            >
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={() => submit("reject")}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Avslår…
                </>
              ) : (
                "Avslå tilbudet"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        size="lg"
        onClick={() => setMode("rejecting")}
      >
        <X className="h-4 w-4" /> Avslå
      </Button>
      <Button
        variant="brand"
        size="lg"
        onClick={() => setMode("accepting")}
      >
        <Check className="h-4 w-4" /> Aksepter og signer
      </Button>
    </div>
  );
}
