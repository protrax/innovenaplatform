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
  const [loading, setLoading] = useState<"pro" | "elite" | "portal" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(tier: "pro" | "elite") {
    setLoading(tier);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, tier }),
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
      setLoading(null);
    }
  }

  async function openPortal() {
    setLoading("portal");
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
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      {active ? (
        <Button
          variant="outline"
          onClick={openPortal}
          disabled={loading !== null || !stripeConfigured}
        >
          {loading === "portal" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Åpner…
            </>
          ) : (
            "Administrer abonnement"
          )}
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="brand"
            onClick={() => startCheckout("pro")}
            disabled={loading !== null || !stripeConfigured}
          >
            {loading === "pro" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Videresender…
              </>
            ) : (
              "Start Pro Leads — 2 990 kr/mnd"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => startCheckout("elite")}
            disabled={loading !== null || !stripeConfigured}
          >
            {loading === "elite" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Videresender…
              </>
            ) : (
              "Start Elite — 6 990 kr/mnd"
            )}
          </Button>
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
