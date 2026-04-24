import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Monthly Recurring Revenue plan. Hard-coded for now — when we add multiple
// tiers this should be derived from Stripe subscription prices.
const SUBSCRIPTION_PRICE_NOK = 990;

function startOfMonthISO(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

function startOfMonthsAgoISO(months: number): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1),
  ).toISOString();
}

export interface AdminStats {
  mrr_nok: number;
  active_subscriptions: number;
  fees_this_month_nok: number;
  fees_lifetime_nok: number;
  contracts_this_month: number;
  contracts_this_month_value_nok: number;
  gmv_lifetime_nok: number;
  gmv_this_month_nok: number;
  leads_this_month: number;
  leads_lifetime: number;
  new_bids_this_month: number;
  tenants_active: number;
  tenants_pending: number;
  tenants_suspended: number;
  customers_lifetime: number;
  match_rate_pct: number; // % of projects that got >= 1 bid
  win_rate_pct: number; // accepted / (accepted + rejected)
  top_agencies: Array<{
    tenant_id: string;
    name: string;
    wins: number;
    total_value_nok: number;
  }>;
  monthly_trend: Array<{
    month: string;
    leads: number;
    contracts: number;
    value_nok: number;
  }>;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  // Use admin client since admin users may not have RLS shortcuts on every
  // table, and we want authoritative numbers.
  const supabase = createAdminClient();
  const monthStart = startOfMonthISO();

  const [
    subsRes,
    contractsMonth,
    contractsLifetime,
    paidInvoicesMonth,
    paidInvoicesLifetime,
    leadsMonth,
    leadsLifetime,
    bidsMonth,
    tenantsByStatus,
    customersCount,
    projectsCount,
    projectsWithBids,
    closedBids,
    topAgenciesData,
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("contracts")
      .select("amount_nok")
      .gte("created_at", monthStart),
    supabase.from("contracts").select("amount_nok"),
    supabase
      .from("invoices")
      .select("platform_fee_nok")
      .eq("status", "paid")
      .gte("paid_at", monthStart),
    supabase
      .from("invoices")
      .select("platform_fee_nok")
      .eq("status", "paid"),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase
      .from("bids")
      .select("id", { count: "exact", head: true })
      .not("sent_at", "is", null)
      .gte("sent_at", monthStart),
    supabase.from("tenants").select("status"),
    supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "customer"),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase
      .from("projects")
      .select("id, bids(id)")
      .limit(1000),
    supabase.from("bids").select("status"),
    supabase
      .from("bids")
      .select("tenant_id, amount_nok, status, tenants!inner(name)")
      .eq("status", "accepted"),
  ]);

  const activeSubscriptions = subsRes.count ?? 0;
  const mrr = activeSubscriptions * SUBSCRIPTION_PRICE_NOK;

  const feesThisMonth = (paidInvoicesMonth.data ?? []).reduce(
    (sum, i) => sum + (i.platform_fee_nok ?? 0),
    0,
  );
  const feesLifetime = (paidInvoicesLifetime.data ?? []).reduce(
    (sum, i) => sum + (i.platform_fee_nok ?? 0),
    0,
  );

  const contractsThisMonthCount = contractsMonth.data?.length ?? 0;
  const contractsThisMonthValue = (contractsMonth.data ?? []).reduce(
    (sum, c) => sum + c.amount_nok,
    0,
  );
  const gmvLifetime = (contractsLifetime.data ?? []).reduce(
    (sum, c) => sum + c.amount_nok,
    0,
  );

  const tenantStatuses = { active: 0, pending_approval: 0, suspended: 0 };
  for (const t of tenantsByStatus.data ?? []) {
    if (t.status in tenantStatuses) {
      tenantStatuses[t.status as keyof typeof tenantStatuses]++;
    }
  }

  // Match rate: projects with at least 1 bid / total projects
  const projectsWithBidsCount = (projectsWithBids.data ?? []).filter((p) => {
    const bids = p.bids as unknown as Array<unknown>;
    return Array.isArray(bids) && bids.length > 0;
  }).length;
  const matchRate =
    (projectsCount.count ?? 0) > 0
      ? Math.round((projectsWithBidsCount / projectsCount.count!) * 100)
      : 0;

  const accepted = (closedBids.data ?? []).filter(
    (b) => b.status === "accepted",
  ).length;
  const rejected = (closedBids.data ?? []).filter(
    (b) => b.status === "rejected",
  ).length;
  const winRate =
    accepted + rejected > 0
      ? Math.round((accepted / (accepted + rejected)) * 100)
      : 0;

  // Top agencies
  const byTenant = new Map<
    string,
    { name: string; wins: number; total_value_nok: number }
  >();
  for (const b of topAgenciesData.data ?? []) {
    const tenantName =
      (b.tenants as unknown as { name: string } | null)?.name ?? "Ukjent";
    const existing = byTenant.get(b.tenant_id) ?? {
      name: tenantName,
      wins: 0,
      total_value_nok: 0,
    };
    existing.wins++;
    existing.total_value_nok += b.amount_nok;
    byTenant.set(b.tenant_id, existing);
  }
  const topAgencies = Array.from(byTenant.entries())
    .map(([tenant_id, v]) => ({ tenant_id, ...v }))
    .sort((a, b) => b.total_value_nok - a.total_value_nok)
    .slice(0, 10);

  // Monthly trend — last 6 months of leads + contracts
  const trendStart = startOfMonthsAgoISO(5);
  const [trendProjects, trendContracts] = await Promise.all([
    supabase
      .from("projects")
      .select("created_at")
      .gte("created_at", trendStart),
    supabase
      .from("contracts")
      .select("created_at, amount_nok")
      .gte("created_at", trendStart),
  ]);

  const trendByMonth = new Map<
    string,
    { leads: number; contracts: number; value_nok: number }
  >();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = d.toISOString().slice(0, 7); // YYYY-MM
    trendByMonth.set(key, { leads: 0, contracts: 0, value_nok: 0 });
  }
  for (const p of trendProjects.data ?? []) {
    const key = p.created_at.slice(0, 7);
    const row = trendByMonth.get(key);
    if (row) row.leads++;
  }
  for (const c of trendContracts.data ?? []) {
    const key = c.created_at.slice(0, 7);
    const row = trendByMonth.get(key);
    if (row) {
      row.contracts++;
      row.value_nok += c.amount_nok;
    }
  }

  return {
    mrr_nok: mrr,
    active_subscriptions: activeSubscriptions,
    fees_this_month_nok: feesThisMonth,
    fees_lifetime_nok: feesLifetime,
    contracts_this_month: contractsThisMonthCount,
    contracts_this_month_value_nok: contractsThisMonthValue,
    gmv_lifetime_nok: gmvLifetime,
    gmv_this_month_nok: contractsThisMonthValue,
    leads_this_month: leadsMonth.count ?? 0,
    leads_lifetime: leadsLifetime.count ?? 0,
    new_bids_this_month: bidsMonth.count ?? 0,
    tenants_active: tenantStatuses.active,
    tenants_pending: tenantStatuses.pending_approval,
    tenants_suspended: tenantStatuses.suspended,
    customers_lifetime: customersCount.count ?? 0,
    match_rate_pct: matchRate,
    win_rate_pct: winRate,
    top_agencies: topAgencies,
    monthly_trend: Array.from(trendByMonth.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

export interface AgencyStats {
  leads_this_month: number;
  leads_lifetime: number;
  bids_sent_this_month: number;
  bids_open: number;
  bids_open_value_nok: number;
  wins_this_month: number;
  wins_this_month_value_nok: number;
  wins_lifetime: number;
  wins_lifetime_value_nok: number;
  win_rate_pct: number;
  revenue_this_month_nok: number;
  revenue_lifetime_nok: number;
  invoices_outstanding_count: number;
  invoices_outstanding_value_nok: number;
  unread_messages: number;
  avg_response_hours: number | null;
  subscription_status: string | null;
  subscription_period_end: string | null;
}

export async function fetchAgencyStats(params: {
  tenantId: string;
  userId: string;
}): Promise<AgencyStats> {
  const supabase = await createClient();
  const monthStart = startOfMonthISO();

  const [
    leadsMonth,
    leadsLifetime,
    bidsSentMonth,
    bidsOpen,
    wonMonth,
    wonLifetime,
    allBids,
    paidInvoicesMonth,
    paidInvoicesLifetime,
    outstandingInvoices,
    unreadMessages,
    responseBids,
    subscription,
  ] = await Promise.all([
    supabase
      .from("project_leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", params.tenantId)
      .gte("distributed_at", monthStart),
    supabase
      .from("project_leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", params.tenantId),
    supabase
      .from("bids")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", params.tenantId)
      .not("sent_at", "is", null)
      .gte("sent_at", monthStart),
    supabase
      .from("bids")
      .select("amount_nok")
      .eq("tenant_id", params.tenantId)
      .in("status", ["sent", "viewed"]),
    supabase
      .from("contracts")
      .select("amount_nok")
      .eq("tenant_id", params.tenantId)
      .gte("created_at", monthStart),
    supabase
      .from("contracts")
      .select("amount_nok")
      .eq("tenant_id", params.tenantId),
    supabase
      .from("bids")
      .select("status")
      .eq("tenant_id", params.tenantId)
      .in("status", ["accepted", "rejected"]),
    supabase
      .from("invoices")
      .select("amount_nok")
      .eq("tenant_id", params.tenantId)
      .eq("status", "paid")
      .gte("paid_at", monthStart),
    supabase
      .from("invoices")
      .select("amount_nok")
      .eq("tenant_id", params.tenantId)
      .eq("status", "paid"),
    supabase
      .from("invoices")
      .select("total_nok")
      .eq("tenant_id", params.tenantId)
      .in("status", ["sent", "overdue"]),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", params.tenantId)
      .is("read_at", null)
      .neq("sender_id", params.userId),
    supabase
      .from("bids")
      .select("sent_at, project_id, project_leads!inner(distributed_at)")
      .eq("tenant_id", params.tenantId)
      .not("sent_at", "is", null)
      .limit(50),
    supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("tenant_id", params.tenantId)
      .maybeSingle(),
  ]);

  const bidsOpenValue = (bidsOpen.data ?? []).reduce(
    (sum, b) => sum + b.amount_nok,
    0,
  );
  const winsMonthValue = (wonMonth.data ?? []).reduce(
    (sum, c) => sum + c.amount_nok,
    0,
  );
  const winsLifetimeValue = (wonLifetime.data ?? []).reduce(
    (sum, c) => sum + c.amount_nok,
    0,
  );
  const revenueMonth = (paidInvoicesMonth.data ?? []).reduce(
    (sum, i) => sum + i.amount_nok,
    0,
  );
  const revenueLifetime = (paidInvoicesLifetime.data ?? []).reduce(
    (sum, i) => sum + i.amount_nok,
    0,
  );
  const outstandingValue = (outstandingInvoices.data ?? []).reduce(
    (sum, i) => sum + i.total_nok,
    0,
  );

  const accepted = (allBids.data ?? []).filter(
    (b) => b.status === "accepted",
  ).length;
  const rejected = (allBids.data ?? []).filter(
    (b) => b.status === "rejected",
  ).length;
  const winRate =
    accepted + rejected > 0
      ? Math.round((accepted / (accepted + rejected)) * 100)
      : 0;

  // Average response time in hours (bid.sent_at − lead.distributed_at)
  let responseSum = 0;
  let responseCount = 0;
  for (const b of responseBids.data ?? []) {
    const distributed = (
      b.project_leads as unknown as Array<{ distributed_at: string }>
    )?.[0]?.distributed_at;
    if (distributed && b.sent_at) {
      const diff =
        (new Date(b.sent_at).getTime() - new Date(distributed).getTime()) /
        (1000 * 60 * 60);
      if (diff > 0 && diff < 24 * 30) {
        responseSum += diff;
        responseCount++;
      }
    }
  }
  const avgResponseHours =
    responseCount > 0 ? Math.round((responseSum / responseCount) * 10) / 10 : null;

  return {
    leads_this_month: leadsMonth.count ?? 0,
    leads_lifetime: leadsLifetime.count ?? 0,
    bids_sent_this_month: bidsSentMonth.count ?? 0,
    bids_open: bidsOpen.data?.length ?? 0,
    bids_open_value_nok: bidsOpenValue,
    wins_this_month: wonMonth.data?.length ?? 0,
    wins_this_month_value_nok: winsMonthValue,
    wins_lifetime: wonLifetime.data?.length ?? 0,
    wins_lifetime_value_nok: winsLifetimeValue,
    win_rate_pct: winRate,
    revenue_this_month_nok: revenueMonth,
    revenue_lifetime_nok: revenueLifetime,
    invoices_outstanding_count: outstandingInvoices.data?.length ?? 0,
    invoices_outstanding_value_nok: outstandingValue,
    unread_messages: unreadMessages.count ?? 0,
    avg_response_hours: avgResponseHours,
    subscription_status: subscription.data?.status ?? null,
    subscription_period_end: subscription.data?.current_period_end ?? null,
  };
}
