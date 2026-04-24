import { redirect } from "next/navigation";
import { requireUser, defaultRouteForUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SetupTenantForm } from "./setup-tenant-form";

export const dynamic = "force-dynamic";

export default async function Velkommen() {
  const user = await requireUser();

  // Already has a tenant → send them to the right dashboard
  if (user.tenantIds.length > 0) {
    redirect(defaultRouteForUser(user));
  }

  // Pull any metadata from auth.users so we can pre-fill the form
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(user.id);
  const meta = (data?.user?.user_metadata ?? {}) as {
    role?: "byraa" | "solo";
    company_name?: string;
    full_name?: string;
  };

  // DEBUG: query the DB directly via admin to see what's actually there.
  const [membershipRows, rolesRows, tenantsRows] = await Promise.all([
    admin.from("tenant_members").select("*").eq("user_id", user.id),
    admin.from("user_roles").select("role").eq("user_id", user.id),
    admin
      .from("tenants")
      .select("id, name, slug, billing_email")
      .eq("billing_email", user.email),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-4 p-8">
      <div className="rounded-md border border-orange-400 bg-orange-50 p-3 text-xs font-mono">
        <div className="font-semibold">🐛 DEBUG</div>
        <div>user.id: {user.id}</div>
        <div>email: {user.email}</div>
        <div>tenantIds (via RLS): [{user.tenantIds.join(", ")}]</div>
        <div>roles (via RLS): [{user.roles.join(", ")}]</div>
        <div>
          tenant_members (admin view):{" "}
          {JSON.stringify(membershipRows.data)}
        </div>
        <div>
          user_roles (admin view): {JSON.stringify(rolesRows.data)}
        </div>
        <div>
          tenants billed to this email:{" "}
          {JSON.stringify(tenantsRows.data)}
        </div>
        <div>user_metadata: {JSON.stringify(meta)}</div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Fullfør kontooppsettet</CardTitle>
          <CardDescription>
            Vi mangler noen detaljer før vi kan gi deg tilgang til dashbordet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupTenantForm
            initialRole={meta.role ?? "byraa"}
            initialCompanyName={meta.company_name ?? ""}
            initialFullName={meta.full_name ?? user.fullName ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
