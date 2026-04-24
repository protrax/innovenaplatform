import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";

// Stripe webhooks require the raw body for signature verification.
export async function POST(request: Request) {
  if (!serverEnv.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      serverEnv.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Signature verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoice_id;
      if (invoiceId && session.payment_status === "paid") {
        const paidAt = new Date().toISOString();
        await admin
          .from("invoices")
          .update({ status: "paid", paid_at: paidAt })
          .eq("id", invoiceId);

        const { data: invoice } = await admin
          .from("invoices")
          .select(
            "tenant_id, customer_id, amount_nok, total_nok, project_id, tenants(name)",
          )
          .eq("id", invoiceId)
          .maybeSingle();
        if (invoice) {
          const [{ data: customer }, { data: project }] = await Promise.all([
            admin
              .from("profiles")
              .select("full_name, email")
              .eq("id", invoice.customer_id)
              .maybeSingle(),
            invoice.project_id
              ? admin
                  .from("projects")
                  .select("title")
                  .eq("id", invoice.project_id)
                  .maybeSingle()
              : Promise.resolve({ data: null as { title: string } | null }),
          ]);
          const tenantName =
            (invoice.tenants as unknown as { name: string } | null)?.name ??
            "Byrå";

          // Notify tenant
          void sendEmail({
            type: "invoice_paid",
            to_tenant_id: invoice.tenant_id,
            customer_name: customer?.full_name ?? customer?.email ?? "Kunde",
            project_title: project?.title ?? null,
            amount_nok: invoice.amount_nok,
          });

          // Receipt to customer
          void sendEmail({
            type: "payment_receipt",
            to_user_id: invoice.customer_id,
            tenant_name: tenantName,
            amount_nok: invoice.total_nok ?? invoice.amount_nok,
            project_title: project?.title ?? null,
            paid_at: paidAt,
          });
        }
      }
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoice_id;
      if (invoiceId) {
        await admin
          .from("invoices")
          .update({ status: "overdue" })
          .eq("id", invoiceId)
          .eq("status", "sent");
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const tenantId = subscription.metadata?.tenant_id;
      if (tenantId) {
        const currentPeriodEnd = (
          subscription as unknown as { current_period_end: number }
        ).current_period_end;

        // Look up previous status so we only email on transitions
        const { data: prev } = await admin
          .from("subscriptions")
          .select("status")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        await admin
          .from("subscriptions")
          .upsert(
            {
              tenant_id: tenantId,
              stripe_subscription_id: subscription.id,
              stripe_price_id: subscription.items.data[0]?.price.id ?? null,
              status: subscription.status,
              current_period_end: currentPeriodEnd
                ? new Date(currentPeriodEnd * 1000).toISOString()
                : null,
              cancel_at_period_end: subscription.cancel_at_period_end,
            },
            { onConflict: "tenant_id" },
          );

        if (prev?.status !== subscription.status) {
          const { data: tenant } = await admin
            .from("tenants")
            .select("name")
            .eq("id", tenantId)
            .maybeSingle();
          const tenantName = tenant?.name ?? "Byrå";
          if (subscription.status === "active") {
            void sendEmail({
              type: "subscription_activated",
              to_tenant_id: tenantId,
              tenant_name: tenantName,
            });
          } else if (subscription.status === "past_due") {
            void sendEmail({
              type: "subscription_past_due",
              to_tenant_id: tenantId,
              tenant_name: tenantName,
            });
          }
        }
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const tenantId = subscription.metadata?.tenant_id;
      if (tenantId) {
        const currentPeriodEnd = (
          subscription as unknown as { current_period_end: number | null }
        ).current_period_end;
        await admin
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("tenant_id", tenantId);

        const { data: tenant } = await admin
          .from("tenants")
          .select("name")
          .eq("id", tenantId)
          .maybeSingle();
        void sendEmail({
          type: "subscription_canceled",
          to_tenant_id: tenantId,
          tenant_name: tenant?.name ?? "Byrå",
          period_end: currentPeriodEnd
            ? new Date(currentPeriodEnd * 1000).toISOString()
            : null,
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
