import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { clientEnv } from "@/lib/env";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("project"),
    project_id: z.string().uuid(),
    body: z.string().min(1).max(4000),
  }),
  z.object({
    channel: z.literal("bid"),
    bid_id: z.string().uuid(),
    body: z.string().min(1).max(4000),
  }),
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: memberships } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id);
  const tenantIds = (memberships ?? []).map((m) => m.tenant_id);

  let tenantId: string | null = null;
  let projectId: string | null = null;
  let bidId: string | null = null;
  let customerId: string;
  let projectTitle: string;

  if (parsed.data.channel === "project") {
    projectId = parsed.data.project_id;
    const { data: project } = await supabase
      .from("projects")
      .select("id, title, customer_id")
      .eq("id", parsed.data.project_id)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    customerId = project.customer_id;
    projectTitle = project.title;
    if (tenantIds.length > 0) {
      const { data: lead } = await supabase
        .from("project_leads")
        .select("tenant_id")
        .eq("project_id", project.id)
        .in("tenant_id", tenantIds)
        .limit(1)
        .maybeSingle();
      tenantId = lead?.tenant_id ?? null;
    }
    if (!tenantId && project.customer_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    bidId = parsed.data.bid_id;
    const { data: bid } = await supabase
      .from("bids")
      .select("id, tenant_id, project_id, projects!inner(title, customer_id)")
      .eq("id", parsed.data.bid_id)
      .maybeSingle();
    if (!bid) {
      return NextResponse.json({ error: "Bid not found" }, { status: 404 });
    }
    const project = bid.projects as unknown as {
      title: string;
      customer_id: string;
    };
    customerId = project.customer_id;
    projectTitle = project.title;
    projectId = bid.project_id;
    // Verify sender is either the customer or a member of the bid's tenant
    const isCustomer = customerId === user.id;
    const isTenantMember = tenantIds.includes(bid.tenant_id);
    if (!isCustomer && !isTenantMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    tenantId = bid.tenant_id;
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      channel: parsed.data.channel,
      project_id: projectId,
      bid_id: bidId,
      tenant_id: tenantId,
      sender_id: user.id,
      body: parsed.data.body,
    })
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke sende melding" },
      { status: 500 },
    );
  }

  // Email the other party (fire-and-forget)
  const isCustomerSender = user.id === customerId;
  const { data: senderProfile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const fromName =
    senderProfile?.full_name ??
    senderProfile?.email?.split("@")[0] ??
    "Noen";
  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const threadUrl = bidId
    ? isCustomerSender
      ? `${appUrl}/byraa/leads/${projectId}`
      : `${appUrl}/kunde/tilbud/${bidId}`
    : isCustomerSender
      ? `${appUrl}/byraa/leads/${projectId}`
      : `${appUrl}/kunde/prosjekter/${projectId}`;

  if (isCustomerSender && tenantId) {
    void sendEmail({
      type: "new_message",
      to_tenant_id: tenantId,
      from_name: fromName,
      body_preview: parsed.data.body,
      thread_label: projectTitle,
      thread_url: threadUrl,
    });
  } else if (!isCustomerSender) {
    void sendEmail({
      type: "new_message",
      to_user_id: customerId,
      from_name: fromName,
      body_preview: parsed.data.body,
      thread_label: projectTitle,
      thread_url: threadUrl,
    });
  }

  return NextResponse.json({ ok: true, message: data });
}
