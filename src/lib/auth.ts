import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string | null;
  roles: UserRole[];
  tenantIds: string[];
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profileRes, rolesRes, membershipsRes] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("tenant_members").select("tenant_id").eq("user_id", user.id),
  ]);

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profileRes.data?.full_name ?? null,
    roles: (rolesRes.data ?? []).map((r) => r.role as UserRole),
    tenantIds: (membershipsRes.data ?? []).map((m) => m.tenant_id),
  };
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/logg-inn");
  return user;
}

export async function requireRole(role: UserRole): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (!user.roles.includes(role) && !user.roles.includes("admin")) {
    redirect("/");
  }
  return user;
}

export function defaultRouteForUser(user: AuthenticatedUser): string {
  if (user.roles.includes("admin")) return "/admin";
  if (user.roles.includes("agency_member") || user.roles.includes("consultant")) {
    return "/byraa";
  }
  if (user.roles.includes("customer")) return "/kunde";
  return "/velkommen";
}
