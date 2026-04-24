import Stripe from "stripe";
import { requireStripeEnv, serverEnv } from "@/lib/env";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  const { secretKey } = requireStripeEnv();
  if (!cached) {
    cached = new Stripe(secretKey, {
      typescript: true,
    });
  }
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(serverEnv.STRIPE_SECRET_KEY);
}
