import { getStripe } from "./client";
import { clientEnv } from "@/lib/env";

export interface CreatePaymentLinkInput {
  invoiceId: string;
  amountNok: number;
  description: string;
  customerEmail: string;
  tenantName: string;
  platformFeePercent: number;
  platformFeeEnabled: boolean;
}

export interface CreatedPaymentLink {
  url: string;
  checkoutSessionId: string;
  totalNok: number;
  platformFeeNok: number;
}

/**
 * Creates a one-time Stripe Checkout Session (hosted payment page).
 *
 * We use Checkout Sessions (not Payment Links) because:
 *  - We need the session ID to link webhook events back to the invoice
 *  - We can attach metadata and pre-fill customer email
 *  - The returned URL is a fully functional hosted payment page
 *
 * Platform fee is added as a separate line item (servicegebyr), transparent
 * to the customer. All funds go to Innovena's Stripe account for now;
 * pay-out to the agency is handled manually until Stripe Connect is wired up.
 */
export async function createInvoicePaymentLink(
  input: CreatePaymentLinkInput,
): Promise<CreatedPaymentLink> {
  const stripe = getStripe();
  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const amountOre = Math.round(input.amountNok * 100);
  const platformFeeOre = input.platformFeeEnabled
    ? Math.round((amountOre * input.platformFeePercent) / 100)
    : 0;

  const lineItems: {
    price_data: {
      currency: string;
      product_data: { name: string; description?: string };
      unit_amount: number;
    };
    quantity: number;
  }[] = [
    {
      price_data: {
        currency: "nok",
        product_data: {
          name: `${input.tenantName} — ${input.description}`,
        },
        unit_amount: amountOre,
      },
      quantity: 1,
    },
  ];

  if (platformFeeOre > 0) {
    lineItems.push({
      price_data: {
        currency: "nok",
        product_data: {
          name: "Servicegebyr",
          description: `${input.platformFeePercent}% plattformgebyr for Innovena`,
        },
        unit_amount: platformFeeOre,
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.customerEmail,
    line_items: lineItems,
    success_url: `${appUrl}/kunde/betaling/suksess?invoice_id=${input.invoiceId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/kunde/prosjekter?betaling=avbrutt`,
    metadata: {
      invoice_id: input.invoiceId,
    },
    payment_intent_data: {
      metadata: {
        invoice_id: input.invoiceId,
      },
    },
    locale: "nb",
  });

  if (!session.url) {
    throw new Error("Stripe returnerte ingen checkout URL");
  }

  return {
    url: session.url,
    checkoutSessionId: session.id,
    totalNok: (amountOre + platformFeeOre) / 100,
    platformFeeNok: platformFeeOre / 100,
  };
}
