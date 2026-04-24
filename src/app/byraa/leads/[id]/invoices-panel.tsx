"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrencyNOK, formatDate } from "@/lib/utils";
import { Copy, ExternalLink, Link2, Loader2, Plus } from "lucide-react";

interface Invoice {
  id: string;
  amount_nok: number;
  total_nok: number;
  platform_fee_nok: number;
  status: string;
  description: string | null;
  stripe_payment_link_url: string | null;
  created_at: string;
  paid_at: string | null;
}

export function InvoicesPanel({
  projectId,
  invoices,
  stripeConfigured,
}: {
  projectId: string;
  invoices: Invoice[];
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sendingLinkFor, setSendingLinkFor] = useState<string | null>(null);

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          amount_nok: Number(amount),
          description,
          due_date: dueDate || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Kunne ikke opprette faktura");
        return;
      }
      setShowForm(false);
      setAmount("");
      setDescription("");
      setDueDate("");
      router.refresh();
    });
  }

  async function sendPaymentLink(invoiceId: string) {
    setError(null);
    setSendingLinkFor(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment-link`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Kunne ikke opprette betalingslenke");
        return;
      }
      router.refresh();
    } finally {
      setSendingLinkFor(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Fakturaer</CardTitle>
            <CardDescription>
              Send betalingslenker direkte til kunden.
            </CardDescription>
          </div>
          {!showForm ? (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> Ny faktura
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm ? (
          <form
            onSubmit={create}
            className="space-y-3 rounded-md border border-border p-4"
          >
            <div className="space-y-2">
              <Label htmlFor="invoice-desc">Beskrivelse</Label>
              <Textarea
                id="invoice-desc"
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="F.eks. Depositum (30%) for ny nettside"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="invoice-amount">Beløp (NOK)</Label>
                <Input
                  id="invoice-amount"
                  type="number"
                  min={100}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-due">Forfallsdato</Label>
                <Input
                  id="invoice-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
                disabled={isPending}
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                variant="brand"
                size="sm"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Oppretter…
                  </>
                ) : (
                  "Opprett faktura"
                )}
              </Button>
            </div>
          </form>
        ) : null}

        {invoices.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Ingen fakturaer ennå.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {invoices.map((inv) => (
              <li key={inv.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {inv.description ?? "Faktura"}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Opprettet {formatDate(inv.created_at)}
                      {inv.paid_at ? ` · Betalt ${formatDate(inv.paid_at)}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatCurrencyNOK(inv.amount_nok)}
                      {inv.platform_fee_nok > 0
                        ? ` + servicegebyr ${formatCurrencyNOK(inv.platform_fee_nok)} = ${formatCurrencyNOK(inv.total_nok)}`
                        : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant={
                        inv.status === "paid"
                          ? "brand"
                          : inv.status === "sent"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {inv.status}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {inv.stripe_payment_link_url ? (
                    <>
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={inv.stripe_payment_link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" /> Åpne lenke
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            inv.stripe_payment_link_url!,
                          );
                        }}
                      >
                        <Copy className="h-3 w-3" /> Kopier
                      </Button>
                    </>
                  ) : inv.status === "draft" ? (
                    <Button
                      size="sm"
                      variant="brand"
                      disabled={
                        !stripeConfigured || sendingLinkFor === inv.id
                      }
                      onClick={() => sendPaymentLink(inv.id)}
                    >
                      {sendingLinkFor === inv.id ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" /> Lager lenke…
                        </>
                      ) : (
                        <>
                          <Link2 className="h-3 w-3" /> Opprett betalingslenke
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!stripeConfigured ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            Stripe er ikke konfigurert. Sett STRIPE_SECRET_KEY i miljøvariablene
            for å aktivere betalingslenker.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
