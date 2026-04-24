import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TenantStatusActions } from "./tenant-status-actions";
import { formatDate } from "@/lib/utils";

export default async function AdminByraaerPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Byråer & konsulenter</h2>
        <p className="text-sm text-muted-foreground">
          Godkjenn nye byråer og administrer status.
        </p>
      </div>

      {!tenants || tenants.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen byråer registrert ennå</CardTitle>
            <CardDescription>
              Når byråer registrerer seg dukker de opp her for godkjenning.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {tenants.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <CardDescription>
                      {t.type} · registrert {formatDate(t.created_at)}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={t.status === "active" ? "brand" : "outline"}
                  >
                    {t.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <TenantStatusActions tenantId={t.id} currentStatus={t.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
