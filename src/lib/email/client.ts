import { Resend } from "resend";
import { serverEnv } from "@/lib/env";

let cached: Resend | null = null;

export function getResend(): Resend {
  if (!serverEnv.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY mangler — e-postvarsling er ikke aktivert.");
  }
  if (!cached) {
    cached = new Resend(serverEnv.RESEND_API_KEY);
  }
  return cached;
}

export function isEmailConfigured(): boolean {
  return Boolean(serverEnv.RESEND_API_KEY);
}

export function getFromEmail(): string {
  return serverEnv.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
}
