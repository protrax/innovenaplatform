import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured } from "@/lib/stripe/client";
import { isAiConfigured } from "@/lib/ai/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { formatCurrencyNOK, formatDate } from "@/lib/utils";
import { markLeadViewed } from "./actions";
import { markThreadRead } from "@/lib/messages";
import { InvoicesPanel } from "./invoices-panel";
import { BidForm } from "./bid-form";
import { TasksPanel } from "@/components/workspace/tasks-panel";
import { MessagesPanel } from "@/components/workspace/messages-panel";
import { FilesPanel } from "@/components/workspace/files-panel";
import { BidMessagesPanel } from "@/components/workspace/bid-messages-panel";
import { fetchWorkspaceData } from "@/lib/workspace";

export default async function LeadDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  if (!tenantId) notFound();

  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("project_leads")
    .select("id, viewed_at")
    .eq("project_id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!lead) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: existingBid } = await supabase
    .from("bids")
    .select("*")
    .eq("project_id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, status, title, amount_nok, created_at")
    .eq("project_id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("customer_id", project.customer_id)
    .order("created_at", { ascending: false });

  if (!lead.viewed_at) {
    await markLeadViewed(lead.id);
  }

  await markThreadRead({ projectId: id, userId: user.id });

  const workspace = await fetchWorkspaceData({
    projectId: id,
    tenantId,
    customerId: project.customer_id,
    includeInternal: true,
  });

  // Bid-level messages for pre-contract Q&A
  let bidMessages: {
    id: string;
    body: string;
    sender_id: string;
    created_at: string;
  }[] = [];
  let bidActors: { user_id: string; name: string }[] = [];
  if (existingBid && ["sent", "viewed"].includes(existingBid.status)) {
    await markThreadRead({ bidId: existingBid.id, userId: user.id });
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, body, sender_id, created_at")
      .eq("channel", "bid")
      .eq("bid_id", existingBid.id)
      .order("created_at", { ascending: true });
    bidMessages = msgs ?? [];
    const admin = createAdminClient();
    const { data: customerProfile } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", project.customer_id)
      .maybeSingle();
    bidActors = [
      ...(customerProfile
        ? [
            {
              user_id: customerProfile.id,
              name:
                customerProfile.full_name ??
                customerProfile.email.split("@")[0],
            },
          ]
        : []),
      ...workspace.members,
    ];
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/byraa/leads"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Tilbake til leads
        </Link>
        <h2 className="mt-1 text-2xl font-semibold">{project.title}</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prosjektdetaljer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Markdown>{project.description}</Markdown>
          {(project.budget_min_nok || project.budget_max_nok) && (
            <p className="text-muted-foreground">
              Budsjett:{" "}
              {project.budget_min_nok
                ? formatCurrencyNOK(project.budget_min_nok)
                : "?"}{" "}
              –{" "}
              {project.budget_max_nok
                ? formatCurrencyNOK(project.budget_max_nok)
                : "?"}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Publisert {formatDate(project.created_at)}
          </p>
        </CardContent>
      </Card>

      {contract ? (
        <Card className="border-brand/40 bg-brand/5">
          <CardHeader>
            <CardTitle>Avtale signert</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between text-sm">
            <div>
              <div className="font-medium">{contract.title}</div>
              <div className="text-xs text-muted-foreground">
                {formatCurrencyNOK(contract.amount_nok)} · signert{" "}
                {formatDate(contract.created_at)}
              </div>
            </div>
            <Button asChild variant="brand" size="sm">
              <Link href={`/kontrakter/${contract.id}`}>Åpne kontrakt</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <BidForm
            projectId={id}
            existing={existingBid ?? null}
            aiEnabled={isAiConfigured()}
          />
          {existingBid && ["sent", "viewed"].includes(existingBid.status) ? (
            <BidMessagesPanel
              bidId={existingBid.id}
              currentUserId={user.id}
              initialMessages={bidMessages}
              actors={bidActors}
              counterpartyName="kunden"
            />
          ) : null}
        </>
      )}

      <TasksPanel
        projectId={id}
        initialTasks={workspace.tasks}
        members={workspace.members}
        canEdit
        canSeeInternal
      />

      <MessagesPanel
        projectId={id}
        currentUserId={user.id}
        initialMessages={workspace.messages}
        actors={workspace.actors}
      />

      <FilesPanel
        projectId={id}
        initialFiles={workspace.files}
        currentUserId={user.id}
        canSeeInternal
        canUploadInternal
      />

      <InvoicesPanel
        projectId={id}
        invoices={invoices ?? []}
        stripeConfigured={isStripeConfigured()}
      />
    </div>
  );
}
