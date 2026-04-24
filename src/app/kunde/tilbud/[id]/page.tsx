import { notFound } from "next/navigation";
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
import { Markdown } from "@/components/markdown";
import { formatCurrencyNOK, formatDate } from "@/lib/utils";
import { BidResponseActions } from "./bid-response-actions";
import { markBidViewed } from "./actions";
import { Check, Clock } from "lucide-react";
import { BidMessagesPanel } from "@/components/workspace/bid-messages-panel";
import { createAdminClient } from "@/lib/supabase/admin";
import { markThreadRead } from "@/lib/messages";

export const dynamic = "force-dynamic";

export default async function KundeBidDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: bid } = await supabase
    .from("bids")
    .select(
      "*, tenants!inner(id, name, slug, logo_url, website, description), projects!inner(id, title, customer_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!bid) notFound();
  const project = bid.projects as unknown as {
    id: string;
    title: string;
    customer_id: string;
  };
  if (project.customer_id !== user.id) notFound();

  if (bid.status === "sent") {
    await markBidViewed(bid.id);
  }

  await markThreadRead({ bidId: bid.id, userId: user.id });

  // Fetch messages on this bid
  const { data: bidMessages } = await supabase
    .from("messages")
    .select("id, body, sender_id, created_at")
    .eq("channel", "bid")
    .eq("bid_id", bid.id)
    .order("created_at", { ascending: true });

  // Resolve sender names (customer + tenant members)
  const admin = createAdminClient();
  const senderIds = Array.from(
    new Set([
      user.id,
      ...(bidMessages ?? []).map((m) => m.sender_id),
    ]),
  );
  const { data: tenantMembers } = await admin
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", bid.tenant_id);
  for (const m of tenantMembers ?? []) senderIds.push(m.user_id);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", Array.from(new Set(senderIds)));
  const actors = (profiles ?? []).map((p) => ({
    user_id: p.id,
    name: p.full_name ?? p.email.split("@")[0],
  }));

  const tenant = bid.tenants as unknown as {
    name: string;
    logo_url: string | null;
    website: string | null;
    description: string | null;
  };

  const actionable = ["sent", "viewed"].includes(bid.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/kunde/prosjekter/${project.id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Tilbake til prosjektet
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardDescription>Tilbud fra</CardDescription>
              <CardTitle className="text-2xl">{tenant.name}</CardTitle>
              {tenant.website ? (
                <a
                  href={tenant.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  {tenant.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
            </div>
            <Badge
              variant={
                bid.status === "accepted"
                  ? "brand"
                  : bid.status === "rejected"
                    ? "destructive"
                    : "outline"
              }
            >
              {bid.status === "sent" || bid.status === "viewed"
                ? "Nytt tilbud"
                : bid.status === "accepted"
                  ? "Akseptert"
                  : bid.status === "rejected"
                    ? "Avslått"
                    : bid.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 rounded-md border border-border bg-card p-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Pris</div>
              <div className="text-2xl font-semibold">
                {formatCurrencyNOK(bid.amount_nok)}
              </div>
              <div className="text-xs text-muted-foreground">eks. mva</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Leveringstid</div>
              <div className="text-2xl font-semibold">
                {bid.delivery_weeks ? `${bid.delivery_weeks} uker` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                fra avtalestart
              </div>
            </div>
          </div>

          {bid.summary ? (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Sammendrag
              </div>
              <p className="mt-1 text-base">{bid.summary}</p>
            </div>
          ) : null}

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Om tilbudet
            </div>
            <Markdown>{bid.description}</Markdown>
          </div>

          {bid.includes && bid.includes.length > 0 ? (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Inkludert
              </div>
              <ul className="mt-2 space-y-1.5">
                {bid.includes.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Sendt {bid.sent_at ? formatDate(bid.sent_at) : formatDate(bid.created_at)}
          </div>
        </CardContent>
      </Card>

      {actionable ? (
        <BidResponseActions
          bidId={bid.id}
          amountNok={bid.amount_nok}
          tenantName={tenant.name}
        />
      ) : bid.status === "rejected" && bid.rejected_reason ? (
        <Card>
          <CardHeader>
            <CardTitle>Du avslo dette tilbudet</CardTitle>
            <CardDescription>{bid.rejected_reason}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <BidMessagesPanel
        bidId={bid.id}
        currentUserId={user.id}
        initialMessages={bidMessages ?? []}
        actors={actors}
        counterpartyName={tenant.name}
      />
    </div>
  );
}
