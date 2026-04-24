import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";

export const MODEL_FAST = "claude-haiku-4-5";
export const MODEL_QUALITY = "claude-sonnet-4-6";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!serverEnv.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY mangler. Sett den i .env.local for å aktivere AI-wizarden.",
    );
  }
  if (!cached) {
    cached = new Anthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY });
  }
  return cached;
}

export function isAiConfigured(): boolean {
  return Boolean(serverEnv.ANTHROPIC_API_KEY);
}
