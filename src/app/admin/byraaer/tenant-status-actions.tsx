"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import type { TenantStatus } from "@/lib/supabase/types";

export function TenantStatusActions({
  tenantId,
  currentStatus,
  incomplete,
}: {
  tenantId: string;
  currentStatus: TenantStatus;
  /** Vis purreknappen kun der det faktisk mangler noe. */
  incomplete?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<TenantStatus | null>(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function requestInfo() {
    setAsking(true);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/request-info`, {
        method: "POST",
      });
      const body = await res.json();
      setNote(body.message ?? body.error ?? "Ukjent svar");
    } catch {
      setNote("Kunne ikke kontakte serveren.");
    } finally {
      setAsking(false);
    }
  }

  async function updateStatus(status: TenantStatus) {
    setLoading(status);
    const res = await fetch("/api/admin/tenants/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, status }),
    });
    setLoading(null);
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {currentStatus !== "active" ? (
        <Button
          variant="brand"
          size="sm"
          disabled={loading !== null}
          onClick={() => updateStatus("active")}
        >
          {loading === "active" ? "Godkjenner…" : "Godkjenn"}
        </Button>
      ) : null}
      {currentStatus !== "suspended" ? (
        <Button
          variant="outline"
          size="sm"
          disabled={loading !== null}
          onClick={() => updateStatus("suspended")}
        >
          Suspender
        </Button>
      ) : null}
      {currentStatus !== "rejected" ? (
        <Button
          variant="destructive"
          size="sm"
          disabled={loading !== null}
          onClick={() => updateStatus("rejected")}
        >
          Avslå
        </Button>
      ) : null}
      {incomplete ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={asking || loading !== null}
          onClick={requestInfo}
        >
          {asking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          Be om manglende info
        </Button>
      ) : null}
      {note ? (
        <span className="text-xs text-muted-foreground">{note}</span>
      ) : null}
    </div>
  );
}
