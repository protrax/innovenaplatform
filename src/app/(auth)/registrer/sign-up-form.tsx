"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
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

export function SignUpForm({ initialRole }: { initialRole: RoleChoice }) {
  const router = useRouter();
  const [role, setRole] = useState<RoleChoice>(initialRole);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            company_name: companyName,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (!data.user) {
        setError("Noe gikk galt. Prøv igjen.");
        return;
      }

      // If email confirmation is required, no session exists yet
      if (!data.session) {
        setInfo(
          "Vi har sendt deg en bekreftelses-e-post. Klikk lenken i e-posten for å fullføre registreringen.",
        );
        return;
      }

      // Session exists — finalize signup (creates tenant + membership)
      const res = await fetch("/api/auth/finalize-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, fullName, companyName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Ukjent feil" }));
        setError(body.error ?? "Kunne ikke fullføre registrering");
        return;
      }
      router.push("/byraa");
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
        <p className="text-xs text-muted-foreground">
          Er du kunde som vil ha tilbud? Send inn forespørselen din på{" "}
          <a
            href="https://innovena.no"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            innovena.no
          </a>{" "}
          — du får login-lenke på e-post automatisk.
        </p>
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

      <div className="space-y-2">
        <Label htmlFor="email">E-post</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Passord</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {info ? (
        <p className="rounded-md border border-brand/30 bg-brand/5 p-3 text-sm">
          {info}
        </p>
      ) : null}

      <Button type="submit" className="w-full" variant="brand" disabled={loading}>
        {loading ? "Oppretter konto…" : "Opprett konto"}
      </Button>
    </form>
  );
}
