import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyNOK } from "@/lib/utils";

export default async function MarkedsforingPage() {
  const supabase = await createClient();
  const { data: packages } = await supabase
    .from("marketing_packages")
    .select("*")
    .eq("active", true)
    .order("price_nok");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Markedsføringspakker</h2>
        <p className="text-sm text-muted-foreground">
          Få mer synlighet og flere leads. Pakkene administreres av Innovena.
        </p>
      </div>

      {!packages || packages.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen pakker tilgjengelig</CardTitle>
            <CardDescription>
              Innovena legger ut pakker her i fase 4. Hold av plass allerede nå —
              vi varsler deg når det er klart.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{p.name}</CardTitle>
                  <Badge variant="outline">{p.tier}</Badge>
                </div>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-semibold">
                  {formatCurrencyNOK(p.price_nok)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / mnd
                  </span>
                </div>
                <Button variant="brand" size="sm" disabled>
                  Velg pakke (kommer)
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
