import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewConsultantButton } from "./new-consultant-button";
import { formatCurrencyNOK } from "@/lib/utils";

export default async function KonsulenterPage() {
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  if (!tenantId) {
    return <p className="text-sm text-muted-foreground">Ingen tenant funnet.</p>;
  }

  const supabase = await createClient();
  const [consultantsRes, tenantRes] = await Promise.all([
    supabase
      .from("consultant_profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase.from("tenants").select("type").eq("id", tenantId).maybeSingle(),
  ]);

  const consultants = consultantsRes.data ?? [];
  const isSolo = tenantRes.data?.type === "solo_consultant";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">
            {isSolo ? "Min konsulentprofil" : "Konsulenter"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isSolo
              ? "Din egen profil som vises i markedsplassen."
              : "Administrer konsulentene som jobber under ditt byrå."}
          </p>
        </div>
        {!isSolo ? <NewConsultantButton tenantId={tenantId} /> : null}
      </div>

      {consultants.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen konsulenter ennå</CardTitle>
            <CardDescription>
              {isSolo
                ? "Din profil opprettes automatisk når du registrerer deg."
                : "Legg til konsulenter med profil, timepris og tilgjengelighet for å dukke opp i markedsplassen."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {consultants.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {c.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.avatar_url}
                        alt={c.full_name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-sm font-medium text-muted-foreground">
                        {c.full_name
                          .split(" ")
                          .map((n: string) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">{c.full_name}</CardTitle>
                      <CardDescription>{c.title ?? c.headline ?? "—"}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={c.visible_in_marketplace ? "brand" : "outline"}>
                    {c.visible_in_marketplace ? "Synlig" : "Skjult"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                  {c.hourly_rate_nok
                    ? `${formatCurrencyNOK(c.hourly_rate_nok)} / time`
                    : "Timepris ikke satt"}
                  {c.available_hours_per_week
                    ? ` · ${c.available_hours_per_week}t/uke ledig`
                    : ""}
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/byraa/konsulenter/${c.id}`}>Rediger</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
