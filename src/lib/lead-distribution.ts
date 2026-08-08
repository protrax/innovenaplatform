import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

// Prioritert matching, som lovet på landingssiden: byråer med aktivt
// Elite-abonnement går foran Pro Leads, som går foran gratis-byråer.
// Stabil sort — innenfor samme nivå beholdes kategori-match-rekkefølgen.
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

  return [...tenantIds]
    .sort((a, b) => (rank.get(a) ?? 2) - (rank.get(b) ?? 2))
    .slice(0, limit);
}
