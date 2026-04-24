import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminKategorierPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("service_categories")
    .select("*")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Kategorier</h2>
        <p className="text-sm text-muted-foreground">
          Tjenestekategorier som brukes for matching og filtrering.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Kategorier ({categories?.length ?? 0})</CardTitle>
          <CardDescription>
            Redigering og sortering av kategorier kommer i fase 6.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {(categories ?? []).map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>{c.name}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>maks {c.max_agencies_per_lead} byråer / lead</span>
                  <Badge variant={c.active ? "brand" : "outline"}>
                    {c.active ? "aktiv" : "inaktiv"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
