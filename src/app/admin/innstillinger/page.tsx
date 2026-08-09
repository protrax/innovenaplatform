import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { serverEnv } from "@/lib/env";
import { EmailSelfTest } from "./email-self-test";

/**
 * Innstillinger var en tom placeholder («kommer i fase 6»). Den viser nå det
 * som faktisk styrer plattformen, og hvor hver ting endres — for flere av
 * verdiene ligger i miljøvariabler og Stripe, ikke i databasen, og da er det
 * verre å late som de er redigerbare her enn å si hvor de bor.
 */
export const dynamic = "force-dynamic";

function ConfigRow({
  label,
  value,
  ok,
  hint,
}: {
  label: string;
  value: string;
  ok: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint ? (
          <div className="text-xs text-muted-foreground">{hint}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm tabular-nums text-muted-foreground">
          {value}
        </span>
        <Badge variant={ok ? "brand" : "destructive"}>
          {ok ? "OK" : "Mangler"}
        </Badge>
      </div>
    </div>
  );
}

export default async function AdminInnstillingerPage() {
  const proPrice = serverEnv.STRIPE_PRICE_AGENCY_SUBSCRIPTION;
  const elitePrice = serverEnv.STRIPE_PRICE_ELITE_SUBSCRIPTION;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Innstillinger</h2>
        <p className="text-sm text-muted-foreground">
          Hva som styrer plattformen akkurat nå, og hvor hver ting endres.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fordeling av forespørsler</CardTitle>
          <CardDescription>
            Reglene som avgjør hvem som får hvilken forespørsel.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <ConfigRow
            label="Maks byrå per forespørsel"
            value="Per kategori"
            ok
            hint="Settes individuelt under Kategorier. Ved flere kategorier gjelder det strengeste taket."
          />
          <ConfigRow
            label="Maks plasser til gratis-byrå"
            value="2 av 5"
            ok
            hint="Endres i src/lib/lead-distribution.ts (MAX_FREE_RECIPIENTS). Matcher ingen betalende byrå, går alle plassene til gratis."
          />
          <ConfigRow
            label="Rotasjon blant gratis-byrå"
            value="Siste 30 dager"
            ok
            hint="De med færrest mottatte forespørsler går først, så det ikke er de samme som får alt."
          />
          <div className="pt-3">
            <Link
              href="/admin/kategorier"
              className="text-sm underline underline-offset-4"
            >
              Endre tak per kategori →
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Priser og betaling</CardTitle>
          <CardDescription>
            Prisene bor i Stripe. Plattformen kjenner dem via price-ID-er, så en
            prisendring gjøres i Stripe og deretter i miljøvariablene — ikke her.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <ConfigRow
            label="Pro Leads — 2 990 kr/mnd"
            value={proPrice ? "Koblet" : "Ikke satt"}
            ok={Boolean(proPrice)}
            hint="STRIPE_PRICE_AGENCY_SUBSCRIPTION"
          />
          <ConfigRow
            label="Elite — 6 990 kr/mnd"
            value={elitePrice ? "Koblet" : "Ikke satt"}
            ok={Boolean(elitePrice)}
            hint="STRIPE_PRICE_ELITE_SUBSCRIPTION"
          />
          <ConfigRow
            label="Plattformgebyr"
            value="2,5 %"
            ok
            hint="Kun på betalinger som går gjennom plattformen. Fakturerer byrået kunden direkte, påløper ingenting."
          />
          <div className="pt-3">
            <Link
              href="/admin/abonnementer"
              className="text-sm underline underline-offset-4"
            >
              Se hvem som betaler →
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Varsling på e-post</CardTitle>
          <CardDescription>
            E-post kan feile stille. Kjør en testsending hvis du er i tvil på om
            byråer og kunder faktisk får varslene sine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ConfigRow
            label="Avsenderadresse"
            value={serverEnv.RESEND_FROM_EMAIL ? "Satt" : "Ikke satt"}
            ok={Boolean(serverEnv.RESEND_FROM_EMAIL)}
            hint={serverEnv.RESEND_FROM_EMAIL ?? "RESEND_FROM_EMAIL"}
          />
          <ConfigRow
            label="Resend-nøkkel"
            value={serverEnv.RESEND_API_KEY ? "Satt" : "Ikke satt"}
            ok={Boolean(serverEnv.RESEND_API_KEY)}
            hint="RESEND_API_KEY"
          />
          <EmailSelfTest />
        </CardContent>
      </Card>
    </div>
  );
}
