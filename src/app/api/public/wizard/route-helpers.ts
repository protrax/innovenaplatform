import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Public (unauth) AI routes share the same error handling as authed ones.
// No auth check — these are fronted by our landing page. Abuse protection
// relies on Claude's own rate limits and our Anthropic spend budget.
// Consider adding Cloudflare Turnstile or IP-based throttling before launch.
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

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
