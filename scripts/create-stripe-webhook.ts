// One-off: create the Stripe webhook endpoint for production via the API.
// Reads STRIPE_SECRET_KEY from .env.local.
//
// Usage:
//   npx tsx scripts/create-stripe-webhook.ts
//
// Safe to run multiple times — it checks for existing endpoint first and
// prints the signing secret either way. The signing secret is only
// retrievable on creation, so capture it the first run.

import Stripe from "stripe";
import { readFileSync } from "node:fs";

// Read .env.local manually — avoid adding dotenv as dependency
try {
  const envFile = readFileSync(".env.local", "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // .env.local not readable — rely on shell env
}

const SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_URL = "https://innovenaplatform.vercel.app/api/webhooks/stripe";

const EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

async function main() {
  if (!SECRET) {
    console.error("STRIPE_SECRET_KEY missing from .env.local");
    process.exit(1);
  }
  const stripe = new Stripe(SECRET);

  console.log(`Checking for existing webhook at ${WEBHOOK_URL}...`);
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = existing.data.find((w) => w.url === WEBHOOK_URL);

  if (match) {
    console.log(`✓ Endpoint already exists: ${match.id}`);
    console.log(`  Status: ${match.status}`);
    console.log(`  Events: ${match.enabled_events.join(", ")}`);
    console.log(
      "\n⚠ Signing secret is only shown on creation. If you need it, delete this endpoint in dashboard and re-run this script, or click 'Reveal' in Stripe dashboard.",
    );

    // Update events in case they've changed
    const needsUpdate =
      EVENTS.some((e) => !match.enabled_events.includes(e)) ||
      match.enabled_events.length !== EVENTS.length;
    if (needsUpdate) {
      console.log("\nUpdating enabled events...");
      const updated = await stripe.webhookEndpoints.update(match.id, {
        enabled_events: EVENTS,
      });
      console.log(
        `✓ Events updated: ${updated.enabled_events.join(", ")}`,
      );
    }
    return;
  }

  console.log("No endpoint found. Creating new one...");
  const created = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: EVENTS,
    description: "Innovena Platform production webhook",
  });

  console.log("\n✅ Webhook created successfully!\n");
  console.log(`   Endpoint ID: ${created.id}`);
  console.log(`   URL: ${created.url}`);
  console.log(`   Events: ${created.enabled_events.join(", ")}`);
  console.log("\n===============================================");
  console.log("  COPY THIS SIGNING SECRET TO VERCEL ENV VARS:");
  console.log("===============================================");
  console.log(`\n   STRIPE_WEBHOOK_SECRET=${created.secret}\n`);
  console.log("===============================================");
  console.log(
    "\nAfter adding to Vercel env vars, redeploy so the webhook handler picks it up.",
  );
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
