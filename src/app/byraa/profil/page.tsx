import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TenantProfileEditor } from "./tenant-profile-editor";

export const dynamic = "force-dynamic";

export default async function ByraaProfilPage() {
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  if (!tenantId) notFound();

  const supabase = await createClient();
  const [tenantRes, caseStudiesRes] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
    supabase
      .from("case_studies")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
  ]);

  const tenant = tenantRes.data;
  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Offentlig profil</h2>
        <p className="text-sm text-muted-foreground">
          Dette er det kundene ser om dere på{" "}
          <Link
            href={`/byraaer/${tenant.slug}`}
            target="_blank"
            className="text-brand underline-offset-2 hover:underline"
          >
            /byraaer/{tenant.slug}
          </Link>{" "}
          og på innovena.no.
        </p>
      </div>
      <TenantProfileEditor
        tenant={tenant}
        caseStudies={caseStudiesRes.data ?? []}
      />
    </div>
  );
}
