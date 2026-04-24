import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { SubscriptionActions } from "./subscription-actions";

export const dynamic = "force-dynamic";

type Search = Promise<{ subscribed?: string; cancelled?: string }>;

export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  const supabase = await createClient();
  const sp = await searchParams;

  const { data: subscription } = tenantId
    ? await supabase
        .from("subscriptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle()
    : { data: null };

  const active = subscription?.status === "active";
  const stripeConfigured = isStripeConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Abonnement</h2>
        <p className="text-sm text-muted-foreground">
          Lead-abonnement og fakturering.
        </p>
      </div>

      {sp.subscribed === "1" ? (
        <Card className="border-brand/40 bg-brand/5">
          <CardHeader>
            <CardTitle className="text-base">🎉 Velkommen som abonnent</CardTitle>
            <CardDescription>
              Abonnementet er aktivert. Du mottar leads så snart de matcher
              kategoriene du tilbyr.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lead-abonnement</CardTitle>
              <CardDescription>990 kr / mnd · ingen bindingstid</CardDescription>
            </div>
            <Badge variant={active ? "brand" : "outline"}>
              {subscription?.status ?? "ikke aktiv"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            <Feature>Motta matchende leads direkte i din pipeline</Feature>
            <Feature>CRM-kanban med tilpassbare stadier</Feature>
            <Feature>Send ubegrenset antall tilbud</Feature>
            <Feature>Sanntidsmeldinger med kunder</Feature>
            <Feature>Timeføring for hele teamet</Feature>
            <Feature>Konsulentprofiler i marketplace</Feature>
          </ul>
          {tenantId ? (
            <SubscriptionActions
              tenantId={tenantId}
              active={active}
              stripeConfigured={stripeConfigured}
            />
          ) : null}
          {!stripeConfigured ? (
            <p className="text-xs text-muted-foreground">
              Stripe er ikke konfigurert ennå. Admin må sette STRIPE_SECRET_KEY
              og STRIPE_PRICE_AGENCY_SUBSCRIPTION for å aktivere betaling.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Markedsføringspakker</CardTitle>
          <CardDescription>
            Oppgrader for mer synlighet på innovena.no og flere leads fra Google
            / Meta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/byraa/markedsforing"
            className="text-sm text-brand underline-offset-2 hover:underline"
          >
            Se pakker →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 text-brand" />
      <span>{children}</span>
    </li>
  );
}
