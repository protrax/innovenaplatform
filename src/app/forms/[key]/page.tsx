import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmbedForm } from "./embed-form";

export const dynamic = "force-dynamic";

// Hosted contact form a tenant can link to or iframe. Identified by their
// webhook_key — no auth needed from visitors. The form POSTs to the same
// public endpoint the webhook uses, so data flows identically.
export default async function HostedForm({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, logo_url, description")
    .eq("webhook_key", key)
    .maybeSingle();
  if (!tenant) notFound();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-lg space-y-6 py-12">
        <div className="space-y-2 text-center">
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="mx-auto h-12 w-auto"
            />
          ) : null}
          <h1 className="text-2xl font-semibold">Kontakt {tenant.name}</h1>
          {tenant.description ? (
            <p className="text-sm text-muted-foreground">
              {tenant.description}
            </p>
          ) : null}
        </div>
        <EmbedForm webhookKey={key} tenantName={tenant.name} />
      </div>
    </div>
  );
}
