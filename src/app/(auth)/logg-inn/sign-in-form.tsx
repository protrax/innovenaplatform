"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Loader2, Mail, Lock } from "lucide-react";

type Mode = "password" | "magic";

function parseHashErrors(): {
  errorCode: string | null;
  errorDescription: string | null;
} {
  if (typeof window === "undefined")
    return { errorCode: null, errorDescription: null };
  const hash = window.location.hash.slice(1);
  if (!hash) return { errorCode: null, errorDescription: null };
  const params = new URLSearchParams(hash);
  return {
    errorCode: params.get("error_code"),
    errorDescription: params.get("error_description"),
  };
}

export function SignInForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  // If redirected here with an auth error in the URL hash (e.g. expired
  // magic link), show a friendly message and pre-select the magic-link tab.
  // Reading window.location requires a post-mount effect by design.
  useEffect(() => {
    const { errorCode, errorDescription } = parseHashErrors();
    if (!errorCode) return;
    if (errorCode === "otp_expired") {
      setMode("magic");
      setError(
        "Innloggingslenken er utløpt eller allerede brukt. Be om en ny lenke under.",
      );
    } else if (errorDescription) {
      setError(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError("Noe gikk galt. Prøv igjen.");
        return;
      }
      setInfo(
        `Hvis ${email} har en konto hos oss, har vi sendt en innloggingslenke nå. Sjekk e-posten din.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setError(null);
            setInfo(null);
          }}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md border p-2.5 text-sm transition-colors",
            mode === "password"
              ? "border-brand bg-brand/5"
              : "border-border text-muted-foreground hover:border-foreground/30",
          )}
        >
          <Lock className="h-4 w-4" />
          Passord
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("magic");
            setError(null);
            setInfo(null);
          }}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md border p-2.5 text-sm transition-colors",
            mode === "magic"
              ? "border-brand bg-brand/5"
              : "border-border text-muted-foreground hover:border-foreground/30",
          )}
        >
          <Mail className="h-4 w-4" />
          Lenke på e-post
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            className="w-full"
            variant="brand"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Logger inn…
              </>
            ) : (
              "Logg inn"
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="magic-email">E-post</Label>
            <Input
              id="magic-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Vi sender deg en lenke for å logge inn"
            />
            <p className="text-xs text-muted-foreground">
              Perfekt om du submittet en forespørsel på innovena.no — ingen
              passord å huske.
            </p>
          </div>
          {info ? (
            <p className="rounded-md border border-brand/30 bg-brand/5 p-3 text-sm">
              {info}
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            className="w-full"
            variant="brand"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sender lenke…
              </>
            ) : (
              "Send meg en lenke"
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
