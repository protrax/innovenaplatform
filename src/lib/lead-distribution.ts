import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

/**
 * Hvor mange av plassene på én forespørsel gratis-byråer maks kan ta når det
 * finnes betalende byråer i kategorien. Uten et slikt tak fylte gratis-byråene
 * de ledige plassene og fikk i praksis hvert eneste lead, siden vi sjelden har
 * fem betalende i samme kategori — og da var det ingen grunn til å betale.
 * Taket gir gratis-byråer smaken, ikke driftsgrunnlaget.
 */
const MAX_FREE_RECIPIENTS = 2;

/** Vindu for rettferdighetsrotasjonen blant gratis-byråer. */
const FAIRNESS_WINDOW_DAYS = 30;

/** Fallback når kategorien ikke sier noe annet. */
const DEFAULT_MAX_RECIPIENTS = 5;

/**
 * Slår opp taket for en forespørsel. `service_categories.max_agencies_per_lead`
 * har ligget i skjemaet siden starten og vises i admin, men ble aldri lest —
 * fordelingen brukte alltid hardkodet 5. Treffer forespørselen flere
 * kategorier, gjelder det strengeste taket, ellers ville en kategori med lavt
 * tak kunne omgås ved å hake av en ekstra kategori.
 */
export async function maxRecipientsForCategories(
  categoryIds: string[],
): Promise<number> {
  if (categoryIds.length === 0) return DEFAULT_MAX_RECIPIENTS;

  const admin = createAdminClient();
  const { data } = await admin
    .from("service_categories")
    .select("max_agencies_per_lead")
    .in("id", categoryIds);

  const caps = (data ?? [])
    .map((c) => c.max_agencies_per_lead)
    .filter((n): n is number => typeof n === "number" && n > 0);

  return caps.length > 0 ? Math.min(...caps) : DEFAULT_MAX_RECIPIENTS;
}

/**
 * Prioritert matching: Elite går foran Pro Leads, som går foran gratis-byråer.
 * Stabil sort — innenfor samme nivå beholdes kategori-match-rekkefølgen.
 */
export async function prioritizeTenants(
  tenantIds: string[],
  limit = 5,
): Promise<string[]> {
  if (tenantIds.length <= 1) return tenantIds.slice(0, limit);

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("subscriptions")
    .select("tenant_id, stripe_price_id")
    .in("tenant_id", tenantIds)
    .eq("status", "active");

  const elitePrice = serverEnv.STRIPE_PRICE_ELITE_SUBSCRIPTION;
  const rank = new Map<string, number>();
  for (const s of subs ?? []) {
    const r = s.stripe_price_id === elitePrice ? 0 : 1;
    rank.set(s.tenant_id, Math.min(r, rank.get(s.tenant_id) ?? 2));
  }

  const paying = tenantIds
    .filter((id) => rank.has(id))
    .sort((a, b) => rank.get(a)! - rank.get(b)!);
  const free = tenantIds.filter((id) => !rank.has(id));

  // Ingen betalende byrå i denne kategorien: da finnes det ingen inntekt å
  // beskytte, og kunden skal fortsatt få de tilbudene vi lover. Fyll opp.
  if (paying.length === 0) {
    return (await rotateFree(admin, free)).slice(0, limit);
  }

  const chosen = paying.slice(0, limit);
  const freeSlots = Math.min(MAX_FREE_RECIPIENTS, limit - chosen.length);
  if (freeSlots > 0 && free.length > 0) {
    chosen.push(...(await rotateFree(admin, free)).slice(0, freeSlots));
  }
  return chosen;
}

/**
 * Uten rotasjon ville de samme gratis-byråene tatt plassene hver gang, fordi
 * sorten er stabil på kategori-match. Resten hadde aldri sett et lead og
 * sluttet. Færrest mottatte leads i vinduet går først.
 */
async function rotateFree(
  admin: ReturnType<typeof createAdminClient>,
  free: string[],
): Promise<string[]> {
  if (free.length <= 1) return free;

  const since = new Date(
    Date.now() - FAIRNESS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data } = await admin
    .from("project_leads")
    .select("tenant_id")
    .in("tenant_id", free)
    .gte("distributed_at", since);

  const received = new Map<string, number>();
  for (const row of data ?? []) {
    received.set(row.tenant_id, (received.get(row.tenant_id) ?? 0) + 1);
  }

  return [...free].sort(
    (a, b) => (received.get(a) ?? 0) - (received.get(b) ?? 0),
  );
}
