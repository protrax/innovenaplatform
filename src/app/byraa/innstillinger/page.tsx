import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryToggles } from "./category-toggles";
import { PipelineStagesManager } from "./pipeline-stages";
import { WebhookPanel } from "./webhook-panel";
import { clientEnv } from "@/lib/env";

export default async function ByraaInnstillinger() {
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  const supabase = await createClient();

  if (!tenantId) return null;

  const [tenantRes, categoriesRes, tenantCategoriesRes, stagesRes] =
    await Promise.all([
      supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
      supabase
        .from("service_categories")
        .select("id, name")
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("tenant_categories")
        .select("category_id")
        .eq("tenant_id", tenantId),
      supabase
        .from("pipeline_stages")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order"),
    ]);

  const tenant = tenantRes.data;
  const categories = categoriesRes.data ?? [];
  const activeCategoryIds = (tenantCategoriesRes.data ?? []).map(
    (r) => r.category_id,
  );
  const stages = stagesRes.data ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Innstillinger</h2>

      <Card>
        <CardHeader>
          <CardTitle>Selskap</CardTitle>
          <CardDescription>Grunnleggende info om ditt byrå.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Navn</Label>
            <Input value={tenant?.name ?? ""} readOnly />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Input value={tenant?.status ?? ""} readOnly />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tjenestekategorier</CardTitle>
          <CardDescription>
            Kategorier du tilbyr — dette styrer hvilke leads du mottar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryToggles
            tenantId={tenantId}
            categories={categories}
            initial={activeCategoryIds}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline-stadier</CardTitle>
          <CardDescription>
            Tilpass CRM-stadiene slik ditt team faktisk jobber. Navn, farge og
            rekkefølge er helt opp til deg.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PipelineStagesManager tenantId={tenantId} initial={stages} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook &amp; skjema-integrasjon</CardTitle>
          <CardDescription>
            La kontaktskjemaet på nettsiden deres levere leads rett inn i
            pipelinen. Enten via ferdig skjema vi hoster, eller via API fra
            deres eget skjema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhookPanel
            webhookKey={tenant?.webhook_key ?? ""}
            appUrl={
              clientEnv.NEXT_PUBLIC_APP_URL ?? "https://platform.innovena.no"
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
