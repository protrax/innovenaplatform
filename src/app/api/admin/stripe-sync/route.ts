import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";

export const runtime = "nodejs";

// Admin-only recovery tool: re-sync subscription status from Stripe for every
// tenant with a stripe_customer_id. Use this if webhooks failed to fire and
// agencies have paid but aren't seeing active status.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const admin = createAdminClient();
  const stripe = getStripe();

  const { data: tenants } = await admin
    .from("tenants")
    .select("id, name, stripe_customer_id")
    .not("stripe_customer_id", "is", null);

  const synced: Array<{
    tenant_id: string;
    tenant_name: string;
    action: string;
    subscription_id?: string;
    status?: string;
  }> = [];

  for (const t of tenants ?? []) {
    if (!t.stripe_customer_id) continue;
    const subs = await stripe.subscriptions.list({
      customer: t.stripe_customer_id,
      status: "all",
      limit: 10,
    });
    // Pick the most recent active / trialing / past_due subscription
    const relevant =
      subs.data.find((s) =>
        ["active", "trialing", "past_due"].includes(s.status),
      ) ?? subs.data[0];

    if (!relevant) {
      synced.push({
        tenant_id: t.id,
        tenant_name: t.name,
        action: "no_subscription_in_stripe",
      });
      continue;
    }

    const currentPeriodEnd = (
      relevant as unknown as { current_period_end: number | null }
    ).current_period_end;

    const { error } = await admin.from("subscriptions").upsert(
      {
        tenant_id: t.id,
        stripe_subscription_id: relevant.id,
        stripe_price_id: relevant.items.data[0]?.price.id ?? null,
        status: relevant.status,
        current_period_end: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
        cancel_at_period_end: relevant.cancel_at_period_end,
      },
      { onConflict: "tenant_id" },
    );

    synced.push({
      tenant_id: t.id,
      tenant_name: t.name,
      action: error ? `error: ${error.message}` : "synced",
      subscription_id: relevant.id,
      status: relevant.status,
    });
  }

  return NextResponse.json({ ok: true, count: synced.length, synced });
}
