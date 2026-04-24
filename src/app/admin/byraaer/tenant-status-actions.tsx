"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { TenantStatus } from "@/lib/supabase/types";

export function TenantStatusActions({
  tenantId,
  currentStatus,
}: {
  tenantId: string;
  currentStatus: TenantStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<TenantStatus | null>(null);

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
    <div className="flex gap-2">
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
    </div>
  );
}
