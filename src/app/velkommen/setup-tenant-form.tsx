"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RoleChoice = "byraa" | "solo";

const ROLES: { value: RoleChoice; title: string; body: string }[] = [
  {
    value: "byraa",
    title: "Byrå / konsulenthus",
    body: "Flere konsulenter, CRM, marketplace-profil",
  },
  {
    value: "solo",
    title: "Solo-konsulent",
    body: "Én konsulent — deg selv",
  },
];

export function SetupTenantForm({
  initialRole,
  initialCompanyName,
  initialFullName,
}: {
  initialRole: RoleChoice;
  initialCompanyName: string;
  initialFullName: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState<RoleChoice>(initialRole);
  const [fullName, setFullName] = useState(initialFullName);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/finalize-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, fullName, companyName }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Kunne ikke fullføre oppsett");
        return;
      }
      const next: string = body.next ?? "/byraa";
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Kontotype</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={cn(
                "rounded-md border p-3 text-left text-sm transition-colors",
                role === r.value
                  ? "border-brand bg-brand/5"
                  : "border-border hover:border-foreground/30",
              )}
            >
              <div className="font-medium">{r.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{r.body}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Ditt navn</Label>
        <Input
          id="fullName"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="companyName">
          {role === "byraa" ? "Selskapsnavn" : "Firmanavn (kan være ditt eget)"}
        </Label>
        <Input
          id="companyName"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" variant="brand" disabled={loading}>
        {loading ? "Oppretter…" : "Fullfør oppsett"}
      </Button>
    </form>
  );
}
