import { getStripe } from "./client";
import { clientEnv, serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export interface StartCheckoutInput {
  tenantId: string;
  tenantName: string;
  customerEmail: string;
  returnPath: string; // e.g. /byraa/abonnement
}

export async function startSubscriptionCheckout(
  input: StartCheckoutInput,
): Promise<string> {
  if (!serverEnv.STRIPE_PRICE_AGENCY_SUBSCRIPTION) {
    throw new Error(
      "STRIPE_PRICE_AGENCY_SUBSCRIPTION mangler. Lag et Stripe-produkt + pris (990 kr/mnd) og sett price-ID i .env.local",
    );
  }

  const stripe = getStripe();
  const admin = createAdminClient();
  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Get or create Stripe customer for this tenant
  const { data: tenant } = await admin
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", input.tenantId)
    .maybeSingle();

  let customerId = tenant?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: input.customerEmail,
      name: input.tenantName,
      metadata: { tenant_id: input.tenantId },
    });
    customerId = customer.id;
    await admin
      .from("tenants")
      .update({ stripe_customer_id: customerId })
      .eq("id", input.tenantId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: serverEnv.STRIPE_PRICE_AGENCY_SUBSCRIPTION,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}${input.returnPath}?subscribed=1`,
    cancel_url: `${appUrl}${input.returnPath}?cancelled=1`,
    subscription_data: {
      metadata: { tenant_id: input.tenantId },
    },
    allow_promotion_codes: true,
    locale: "nb",
  });

  if (!session.url) throw new Error("Stripe returnerte ingen checkout URL");
  return session.url;
}

export async function createCustomerPortalSession(
  tenantId: string,
  returnPath: string,
): Promise<string> {
  const stripe = getStripe();
  const admin = createAdminClient();
  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data: tenant } = await admin
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant?.stripe_customer_id) {
    throw new Error("Ingen Stripe-kunde ennå — start abonnement først");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${appUrl}${returnPath}`,
  });
  return session.url;
}
