"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function SubscriptionActions({
  tenantId,
  active,
  stripeConfigured,
}: {
  tenantId: string;
  active: boolean;
  stripeConfigured: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        setError(body.error ?? "Kunne ikke starte abonnement");
        return;
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        setError(body.error ?? "Kunne ikke åpne administrasjon");
        return;
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {active ? (
        <Button
          variant="outline"
          onClick={openPortal}
          disabled={loading || !stripeConfigured}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Åpner…
            </>
          ) : (
            "Administrer abonnement"
          )}
        </Button>
      ) : (
        <Button
          variant="brand"
          onClick={startCheckout}
          disabled={loading || !stripeConfigured}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Videresender…
            </>
          ) : (
            "Start abonnement — 990 kr/mnd"
          )}
        </Button>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
