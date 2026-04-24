import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConsultantEditor } from "./consultant-editor";

export const dynamic = "force-dynamic";

export default async function ConsultantEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: consultant } = await supabase
    .from("consultant_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!consultant) notFound();

  // Authorize: must be a member of the tenant that owns the profile,
  // or be the linked user (solo consultant editing their own profile), or admin
  const isTenantMember = user.tenantIds.includes(consultant.tenant_id);
  const isSelf = consultant.user_id === user.id;
  const isAdmin = user.roles.includes("admin");
  if (!isTenantMember && !isSelf && !isAdmin) notFound();

  const [skillsRes, categoriesRes] = await Promise.all([
    supabase
      .from("consultant_skills")
      .select("category_id, skill_name, service_categories(slug, name)")
      .eq("consultant_id", id),
    supabase
      .from("service_categories")
      .select("id, slug, name")
      .eq("active", true)
      .order("sort_order"),
  ]);

  const skills = (skillsRes.data ?? []).map((s) => ({
    category_id: s.category_id,
    skill_name: s.skill_name,
    category_name:
      (s.service_categories as unknown as { name: string } | null)?.name ??
      null,
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/byraa/konsulenter"
        className="text-xs text-muted-foreground hover:underline"
      >
        ← Tilbake til konsulenter
      </Link>
      <ConsultantEditor
        consultant={consultant}
        skills={skills}
        categories={categoriesRes.data ?? []}
      />
    </div>
  );
}
