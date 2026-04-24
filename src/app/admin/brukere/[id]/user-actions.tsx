"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Link2, Wrench } from "lucide-react";
import type { UserRole } from "@/lib/supabase/types";

const ALL_ROLES: UserRole[] = [
  "admin",
  "agency_member",
  "consultant",
  "customer",
];

export function UserActions({
  userId,
  isSelf,
  currentRoles,
  showRepair,
}: {
  userId: string;
  isSelf: boolean;
  currentRoles: UserRole[];
  showRepair?: boolean;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState<UserRole[]>(currentRoles);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [magicLink, setMagicLink] = useState<string | null>(null);

  async function toggleRole(role: UserRole) {
    setError(null);
    setInfo(null);
    const has = roles.includes(role);
    if (has && isSelf && role === "admin") {
      setError(
        "Du kan ikke fjerne din egen admin-rolle. Be en annen admin gjøre det.",
      );
      return;
    }
    setLoading(role);
    try {
      const res = has
        ? await fetch(`/api/admin/users/${userId}/roles?role=${role}`, {
            method: "DELETE",
          })
        : await fetch(`/api/admin/users/${userId}/roles`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ role }),
          });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Kunne ikke oppdatere");
        return;
      }
      setRoles(has ? roles.filter((r) => r !== role) : [...roles, role]);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function sendMagicLink() {
    setError(null);
    setInfo(null);
    setMagicLink(null);
    setLoading("magic");
    try {
      const res = await fetch(`/api/admin/users/${userId}/magic-link`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Kunne ikke lage lenke");
        return;
      }
      setInfo(`Magic link sendt til ${body.email}`);
      setMagicLink(body.action_link);
    } finally {
      setLoading(null);
    }
  }

  async function repairSignup() {
    setError(null);
    setInfo(null);
    setLoading("repair");
    try {
      const res = await fetch(`/api/admin/users/${userId}/repair-signup`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Kunne ikke reparere");
        return;
      }
      if (body.already_finalized) {
        setInfo("Allerede fullført — ingen endring nødvendig.");
      } else {
        setInfo("Reparert. Tenant og rolle er opprettet.");
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          Roller
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map((r) => {
            const active = roles.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggleRole(r)}
                disabled={loading === r}
                className={
                  active
                    ? "inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand/10 px-3 py-1 text-sm font-medium"
                    : "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-foreground/30"
                }
              >
                {loading === r ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : active ? (
                  <Check className="h-3 w-3" />
                ) : null}
                {r}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Klikk for å toggle. Admin-rollen kan ikke fjerne seg selv.
        </p>
      </div>

      <div>
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          Handlinger
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={sendMagicLink}
            disabled={loading !== null}
          >
            {loading === "magic" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Sender…
              </>
            ) : (
              <>
                <Link2 className="h-3 w-3" /> Send magic-link
              </>
            )}
          </Button>
          {showRepair ? (
            <Button
              variant="brand"
              size="sm"
              onClick={repairSignup}
              disabled={loading !== null}
            >
              {loading === "repair" ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Reparerer…
                </>
              ) : (
                <>
                  <Wrench className="h-3 w-3" /> Reparer signup
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="rounded-md border border-brand/30 bg-brand/5 p-3 text-sm">
          {info}
        </div>
      ) : null}
      {magicLink ? (
        <div className="space-y-2 rounded-md border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Badge variant="outline">Sensitiv</Badge>
            Action-link (utløper etter bruk)
          </div>
          <div className="break-all font-mono text-xs text-muted-foreground">
            {magicLink}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(magicLink);
            }}
          >
            Kopier
          </Button>
          <p className="text-xs text-muted-foreground">
            Kan brukes én gang for å logge inn som brukeren. Del kun hvis de
            eksplisitt ber om det.
          </p>
        </div>
      ) : null}
    </div>
  );
}
