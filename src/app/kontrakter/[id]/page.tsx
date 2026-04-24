import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { formatCurrencyNOK, formatDate } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

type Search = Promise<{ signed?: string }>;

export default async function ContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Search;
}) {
  const { id } = await params;
  const { signed } = await searchParams;

  const user = await requireUser();
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "*, tenants!inner(id, name, slug, org_number), projects!inner(id, title)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!contract) notFound();

  // Authorize: customer, tenant member, or admin
  const isCustomer = contract.customer_id === user.id;
  const isTenantMember = user.tenantIds.includes(contract.tenant_id);
  const isAdmin = user.roles.includes("admin");
  if (!isCustomer && !isTenantMember && !isAdmin) notFound();

  // Use admin client to look up customer email (RLS on profiles hides it from tenant members)
  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", contract.customer_id)
    .maybeSingle();

  const tenant = contract.tenants as unknown as {
    name: string;
    org_number: string | null;
  };

  const backHref = isCustomer
    ? `/kunde/prosjekter/${contract.project_id}`
    : `/byraa/leads/${contract.project_id}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={backHref}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Tilbake
        </Link>
        <PrintButton />
      </div>

      {signed === "1" ? (
        <Card className="border-brand/40 bg-brand/5 print:hidden">
          <CardContent className="flex items-center gap-3 p-4">
            <ShieldCheck className="h-5 w-5 text-brand" />
            <div className="text-sm">
              <div className="font-medium">Kontrakten er signert ✨</div>
              <div className="text-xs text-muted-foreground">
                Begge parter har akseptert elektronisk. Kontrakten er juridisk
                bindende.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="print:border-0 print:shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardDescription>Avtale mellom partene</CardDescription>
              <CardTitle className="text-2xl">{contract.title}</CardTitle>
            </div>
            <Badge
              variant={contract.status === "signed" ? "brand" : "outline"}
              className="print:hidden"
            >
              {contract.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Pris
              </div>
              <div className="text-xl font-semibold">
                {formatCurrencyNOK(contract.amount_nok)}
              </div>
              <div className="text-xs text-muted-foreground">eks. mva</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </div>
              <div className="text-xl font-semibold capitalize">
                {contract.status}
              </div>
              <div className="text-xs text-muted-foreground">
                Opprettet {formatDate(contract.created_at)}
              </div>
            </div>
          </div>

          {contract.body_markdown ? (
            <Markdown>{contract.body_markdown}</Markdown>
          ) : null}

          {contract.terms_markdown ? (
            <div className="border-t border-border pt-6">
              <Markdown>{contract.terms_markdown}</Markdown>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
            <SignatureBlock
              party="Kunde"
              name={customer?.full_name ?? customer?.email ?? ""}
              email={customer?.email ?? ""}
              signedAt={contract.customer_signed_at}
              ip={contract.customer_signed_ip}
            />
            <SignatureBlock
              party="Leverandør"
              name={tenant.name}
              email={tenant.org_number ? `Org.nr. ${tenant.org_number}` : ""}
              signedAt={contract.tenant_signed_at}
              ip={contract.tenant_signed_ip}
            />
          </div>

          <p className="pt-2 text-center text-xs text-muted-foreground">
            Signert digitalt via Innovena Platform · {formatDate(contract.created_at)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SignatureBlock({
  party,
  name,
  email,
  signedAt,
  ip,
}: {
  party: string;
  name: string;
  email: string;
  signedAt: string | null;
  ip: string | null;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {party}
      </div>
      <div className="mt-1 font-semibold">{name}</div>
      <div className="text-xs text-muted-foreground">{email}</div>
      <div className="mt-3 border-t border-border pt-2 text-xs">
        {signedAt ? (
          <>
            <div className="flex items-center gap-1 text-brand">
              <ShieldCheck className="h-3 w-3" /> Elektronisk signert
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {new Date(signedAt).toLocaleString("nb-NO")}
              {ip ? ` · IP ${ip}` : ""}
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">Venter på signatur</div>
        )}
      </div>
    </div>
  );
}
