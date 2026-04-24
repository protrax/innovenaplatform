import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { serverEnv } from "@/lib/env";

// Shared tenant-provisioning logic. Idempotent — safe to call multiple times.
// Reads role + companyName from user_metadata which is set on signUp.
export async function finalizeSignupForUser(userId: string): Promise<{
  ok: boolean;
  next: string;
  alreadyFinalized?: boolean;
  error?: string;
}> {
  const admin = createAdminClient();

  // Already finalized? Skip.
  const { data: existingMember } = await admin
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (existingMember) {
    return { ok: true, next: "/byraa", alreadyFinalized: true };
  }

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const user = userData?.user;
  if (!user) {
    return { ok: false, next: "/logg-inn", error: "auth user not found" };
  }

  const meta = (user.user_metadata ?? {}) as {
    role?: "byraa" | "solo";
    company_name?: string;
    full_name?: string;
  };

  // If no tenant metadata, the user is likely a customer coming via magic-link.
  // Give them the customer role and route them to /kunde.
  if (!meta.role || !meta.company_name) {
    await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "customer" });
    return { ok: true, next: "/kunde" };
  }

  // Ensure profile has full_name
  if (meta.full_name) {
    await admin
      .from("profiles")
      .update({ full_name: meta.full_name })
      .eq("id", userId);
  }

  // Build unique slug
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60);

  const baseSlug = slugify(meta.company_name) || `tenant-${userId.slice(0, 6)}`;
  let finalSlug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const { data: exists } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle();
    if (!exists) break;
    finalSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({
      slug: finalSlug,
      name: meta.company_name,
      type: meta.role === "byraa" ? "agency" : "solo_consultant",
      status: "pending_approval",
      billing_email: user.email,
    })
    .select()
    .single();
  if (tenantError || !tenant) {
    console.error("[finalize-signup] tenant insert failed:", tenantError);
    return {
      ok: false,
      next: "/velkommen",
      error: `tenant insert: ${tenantError?.message ?? "unknown"}`,
    };
  }

  const { error: memberError } = await admin.from("tenant_members").insert({
    tenant_id: tenant.id,
    user_id: userId,
    role: "owner",
  });
  if (memberError) {
    console.error("[finalize-signup] tenant_members insert failed:", memberError);
    return {
      ok: false,
      next: "/velkommen",
      error: `tenant_members insert: ${memberError.message}`,
    };
  }

  await admin.from("user_roles").upsert([
    {
      user_id: userId,
      role: meta.role === "solo" ? "consultant" : "agency_member",
    },
  ]);

  if (meta.role === "solo") {
    await admin.from("consultant_profiles").insert({
      tenant_id: tenant.id,
      user_id: userId,
      slug: `${finalSlug}-${userId.slice(0, 6)}`,
      full_name: meta.full_name ?? user.email ?? "Konsulent",
      visible_in_marketplace: false,
    });
  }

  // Notify admin that a new tenant is pending review.
  if (serverEnv.ADMIN_EMAIL && user.email) {
    void sendEmail({
      type: "new_tenant_pending",
      to_email: serverEnv.ADMIN_EMAIL,
      tenant_name: tenant.name,
      tenant_type: meta.role === "byraa" ? "Byrå" : "Solo-konsulent",
      owner_email: user.email,
    });
  }

  return { ok: true, next: "/byraa" };
}
