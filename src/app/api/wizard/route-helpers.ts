import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export async function requireAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  return { user };
}

export function handleAiError(err: unknown): NextResponse {
  if (err instanceof Anthropic.AuthenticationError) {
    return NextResponse.json(
      { error: "AI-tjenesten er ikke konfigurert riktig." },
      { status: 500 },
    );
  }
  if (err instanceof Anthropic.RateLimitError) {
    return NextResponse.json(
      { error: "AI-tjenesten er overbelastet. Prøv igjen om litt." },
      { status: 429 },
    );
  }
  if (err instanceof Anthropic.BadRequestError) {
    return NextResponse.json(
      { error: `Ugyldig forespørsel til AI: ${err.message}` },
      { status: 400 },
    );
  }
  if (err instanceof Anthropic.APIError) {
    return NextResponse.json(
      { error: `AI-feil (${err.status}): ${err.message}` },
      { status: 502 },
    );
  }
  const message = err instanceof Error ? err.message : "Ukjent feil";
  return NextResponse.json({ error: message }, { status: 500 });
}
