import { z } from "zod";

// Empty-string-to-undefined helper so .env.local placeholders don't fail parsing
const optional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);
const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().url().optional(),
);

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optional,
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_PRICE_AGENCY_SUBSCRIPTION: optional,
  RESEND_API_KEY: optional,
  // Accept either "email@domain.com" or "Name <email@domain.com>" (RFC5322)
  RESEND_FROM_EMAIL: optional,
  // Where new-tenant-signup notifications go (admin inbox)
  ADMIN_EMAIL: optional,
  ANTHROPIC_API_KEY: optional,
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optional,
});

// We keep all optional during scaffolding so `next build` works before the
// user fills in .env.local. Individual call sites (createClient, stripe, etc.)
// throw a clear error if their required vars are missing.
export const serverEnv = serverSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_AGENCY_SUBSCRIPTION: process.env.STRIPE_PRICE_AGENCY_SUBSCRIPTION,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});

export function requireStripeEnv() {
  if (!serverEnv.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY mangler. Sett den i .env.local for å aktivere betalinger.",
    );
  }
  return { secretKey: serverEnv.STRIPE_SECRET_KEY };
}

export function requireSupabaseEnv() {
  if (!clientEnv.NEXT_PUBLIC_SUPABASE_URL || !clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase env vars missing. Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }
  return {
    url: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
