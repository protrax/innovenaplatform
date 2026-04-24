import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyNOK } from "@/lib/utils";
import { Check, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BidComparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, customer_id")
    .eq("id", id)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: bids } = await supabase
    .from("bids")
    .select(
      "id, amount_nok, delivery_weeks, summary, description, includes, status, created_at, tenants!inner(id, name, slug, logo_url, website)",
    )
    .eq("project_id", id)
    .in("status", ["sent", "viewed", "accepted", "rejected"])
    .order("amount_nok", { ascending: true });

  if (!bids || bids.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href={`/kunde/prosjekter/${id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Tilbake til prosjekt
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Ingen tilbud å sammenlikne ennå</CardTitle>
            <CardDescription>
              Matchende byråer blir varslet — det kan ta litt tid før de første
              tilbudene kommer inn.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Find lowest price + shortest delivery for highlights
  const lowestPrice = Math.min(...bids.map((b) => b.amount_nok));
  const shortestDelivery = Math.min(
    ...bids.map((b) => b.delivery_weeks ?? Infinity),
  );

  // Collect all unique include items across all bids for the matrix
  const allIncludes = Array.from(
    new Set(
      bids.flatMap((b) => (b.includes ?? []).map((i: string) => i.trim())),
    ),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/kunde/prosjekter/${id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Tilbake til prosjekt
        </Link>
        <h2 className="mt-1 text-2xl font-semibold">Sammenlikn tilbud</h2>
        <p className="text-sm text-muted-foreground">
          {project.title} · {bids.length} tilbud
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-48 border-b border-border bg-background p-3 text-left font-medium">
                &nbsp;
              </th>
              {bids.map((bid) => {
                const tenant = bid.tenants as unknown as {
                  name: string;
                };
                const isLowest = bid.amount_nok === lowestPrice;
                const isFastest = bid.delivery_weeks === shortestDelivery;
                return (
                  <th
                    key={bid.id}
                    className="min-w-64 border-b border-border p-3 text-left align-top"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold">{tenant.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {isLowest ? (
                          <Badge variant="brand" className="text-[10px]">
                            Laveste pris
                          </Badge>
                        ) : null}
                        {isFastest && shortestDelivery !== Infinity ? (
                          <Badge variant="outline" className="text-[10px]">
                            Raskest
                          </Badge>
                        ) : null}
                        <Badge variant="secondary" className="text-[10px]">
                          {bid.status}
                        </Badge>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <Row label="Pris">
              {bids.map((bid) => (
                <td
                  key={bid.id}
                  className="min-w-64 border-b border-border p-3 align-top"
                >
                  <div className="text-lg font-semibold">
                    {formatCurrencyNOK(bid.amount_nok)}
                  </div>
                  <div className="text-xs text-muted-foreground">eks. mva</div>
                </td>
              ))}
            </Row>

            <Row label="Leveringstid">
              {bids.map((bid) => (
                <td
                  key={bid.id}
                  className="min-w-64 border-b border-border p-3 align-top"
                >
                  {bid.delivery_weeks ? `${bid.delivery_weeks} uker` : "—"}
                </td>
              ))}
            </Row>

            <Row label="Sammendrag">
              {bids.map((bid) => (
                <td
                  key={bid.id}
                  className="min-w-64 border-b border-border p-3 align-top text-xs text-muted-foreground"
                >
                  {bid.summary ?? "—"}
                </td>
              ))}
            </Row>

            {allIncludes.length > 0 ? (
              <>
                <tr>
                  <td
                    colSpan={bids.length + 1}
                    className="border-b border-border bg-accent/30 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Inkludert i leveransen
                  </td>
                </tr>
                {allIncludes.map((feature) => (
                  <tr key={feature}>
                    <td className="sticky left-0 z-10 w-48 border-b border-border bg-background p-3 align-top text-xs">
                      {feature}
                    </td>
                    {bids.map((bid) => {
                      const has = (bid.includes ?? []).some(
                        (i: string) => i.trim() === feature,
                      );
                      return (
                        <td
                          key={bid.id}
                          className="min-w-64 border-b border-border p-3 align-top"
                        >
                          {has ? (
                            <Check className="h-4 w-4 text-brand" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ) : null}

            <tr>
              <td className="sticky left-0 z-10 w-48 bg-background p-3 align-top"></td>
              {bids.map((bid) => (
                <td key={bid.id} className="min-w-64 p-3 align-top">
                  <Button asChild variant="brand" size="sm" className="w-full">
                    <Link href={`/kunde/tilbud/${bid.id}`}>Se fullt tilbud</Link>
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 w-48 border-b border-border bg-background p-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}
