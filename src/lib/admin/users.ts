import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/supabase/types";

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
  roles: UserRole[];
  tenants: Array<{ id: string; name: string; slug: string; role: string }>;
}

// Fetches users from auth.users + enriches with profiles, roles, tenant memberships.
// Admin client required. For large user bases, we paginate in the caller.
export async function listUsers(params: {
  search?: string;
  role?: UserRole;
  limit?: number;
  offset?: number;
}): Promise<{ users: AdminUserRow[]; total: number }> {
  const admin = createAdminClient();
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  // Fetch auth users (admin API handles pagination)
  // NOTE: supabase-js admin.listUsers doesn't yet support filtering by email,
  // so we fetch a page and filter client-side for search.
  const page = Math.floor(offset / limit) + 1;
  const { data: authPage, error } = await admin.auth.admin.listUsers({
    perPage: limit,
    page,
  });
  if (error) throw error;

  const users = authPage?.users ?? [];
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) {
    return { users: [], total: 0 };
  }

  const [profilesRes, rolesRes, membershipsRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds),
    admin.from("user_roles").select("user_id, role").in("user_id", userIds),
    admin
      .from("tenant_members")
      .select(
        "user_id, role, tenants!inner(id, name, slug)",
      )
      .in("user_id", userIds),
  ]);

  const profileById = new Map<string, { full_name: string | null; phone: string | null }>();
  for (const p of profilesRes.data ?? []) {
    profileById.set(p.id, { full_name: p.full_name, phone: p.phone });
  }
  const rolesByUser = new Map<string, UserRole[]>();
  for (const r of rolesRes.data ?? []) {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role as UserRole);
    rolesByUser.set(r.user_id, arr);
  }
  const tenantsByUser = new Map<string, AdminUserRow["tenants"]>();
  for (const m of membershipsRes.data ?? []) {
    const tenant = m.tenants as unknown as { id: string; name: string; slug: string };
    const arr = tenantsByUser.get(m.user_id) ?? [];
    arr.push({ id: tenant.id, name: tenant.name, slug: tenant.slug, role: m.role });
    tenantsByUser.set(m.user_id, arr);
  }

  let rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    full_name: profileById.get(u.id)?.full_name ?? null,
    phone: profileById.get(u.id)?.phone ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    banned: Boolean(
      (u as unknown as { banned_until?: string | null }).banned_until,
    ),
    roles: rolesByUser.get(u.id) ?? [],
    tenants: tenantsByUser.get(u.id) ?? [],
  }));

  if (params.search) {
    const q = params.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        r.full_name?.toLowerCase().includes(q),
    );
  }
  if (params.role) {
    rows = rows.filter((r) => r.roles.includes(params.role!));
  }

  return { users: rows, total: authPage?.total ?? rows.length };
}

export async function getUserDetail(userId: string): Promise<
  | (AdminUserRow & {
      user_metadata: Record<string, unknown> | null;
      projects_count: number;
      bids_count: number;
      contracts_count: number;
    })
  | null
> {
  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  if (!authUser?.user) return null;
  const u = authUser.user;

  const [profileRes, rolesRes, membershipsRes, projectsCount, bidsCount, contractsCount] =
    await Promise.all([
      admin
        .from("profiles")
        .select("full_name, phone")
        .eq("id", userId)
        .maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId),
      admin
        .from("tenant_members")
        .select("role, tenants!inner(id, name, slug)")
        .eq("user_id", userId),
      admin
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", userId),
      admin
        .from("bids")
        .select("id", { count: "exact", head: true })
        .eq("submitted_by", userId),
      admin
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", userId),
    ]);

  return {
    id: u.id,
    email: u.email ?? "",
    full_name: profileRes.data?.full_name ?? null,
    phone: profileRes.data?.phone ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    banned: Boolean(
      (u as unknown as { banned_until?: string | null }).banned_until,
    ),
    roles: (rolesRes.data ?? []).map((r) => r.role as UserRole),
    tenants: (membershipsRes.data ?? []).map((m) => {
      const t = m.tenants as unknown as { id: string; name: string; slug: string };
      return { id: t.id, name: t.name, slug: t.slug, role: m.role };
    }),
    user_metadata: (u.user_metadata as Record<string, unknown>) ?? null,
    projects_count: projectsCount.count ?? 0,
    bids_count: bidsCount.count ?? 0,
    contracts_count: contractsCount.count ?? 0,
  };
}
