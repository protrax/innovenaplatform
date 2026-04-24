import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface Conversation {
  thread_key: string;
  channel: "project" | "bid";
  project_id: string;
  bid_id: string | null;
  project_title: string;
  counterparty_name: string;
  last_message_body: string;
  last_message_at: string;
  last_sender_is_me: boolean;
  unread_count: number;
  href: string;
}

interface MessageRow {
  id: string;
  channel: "project" | "bid" | "contract";
  project_id: string | null;
  bid_id: string | null;
  tenant_id: string | null;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

// Fetch the inbox for a tenant (agency side) OR a customer.
// Returns conversations sorted by most-recent activity, with unread counts.
export async function fetchInbox(params: {
  userId: string;
  side: "agency" | "customer";
  tenantId?: string;
}): Promise<Conversation[]> {
  const supabase = await createClient();
  const admin = createAdminClient();

  // Fetch all messages relevant to this user
  let messagesQuery = supabase
    .from("messages")
    .select(
      "id, channel, project_id, bid_id, tenant_id, sender_id, body, created_at, read_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (params.side === "agency" && params.tenantId) {
    messagesQuery = messagesQuery.eq("tenant_id", params.tenantId);
  }
  // For customer side, RLS already limits to messages on their projects +
  // messages they sent. No extra filter needed.

  const { data: allMessages } = await messagesQuery;
  const messages = (allMessages ?? []) as MessageRow[];

  // Group by (bid_id ?? project_id)
  const threads = new Map<
    string,
    {
      channel: "project" | "bid";
      project_id: string;
      bid_id: string | null;
      latest: MessageRow;
      unread_count: number;
    }
  >();

  for (const m of messages) {
    if (m.channel !== "project" && m.channel !== "bid") continue;
    const key = m.bid_id ?? m.project_id;
    if (!key) continue;

    const existing = threads.get(key);
    const isUnreadForMe =
      m.read_at == null && m.sender_id !== params.userId;

    if (!existing) {
      threads.set(key, {
        channel: m.channel,
        project_id: m.project_id!,
        bid_id: m.bid_id,
        latest: m,
        unread_count: isUnreadForMe ? 1 : 0,
      });
    } else {
      if (isUnreadForMe) existing.unread_count += 1;
    }
  }

  if (threads.size === 0) return [];

  // Fetch project titles + customer names in one query
  const projectIds = Array.from(
    new Set(Array.from(threads.values()).map((t) => t.project_id)),
  );
  const { data: projects } = await admin
    .from("projects")
    .select("id, title, customer_id")
    .in("id", projectIds);
  const projectById = new Map<
    string,
    { title: string; customer_id: string }
  >();
  for (const p of projects ?? []) {
    projectById.set(p.id, { title: p.title, customer_id: p.customer_id });
  }

  // Fetch counterparty names
  const counterpartyIds = new Set<string>();
  for (const t of threads.values()) {
    const project = projectById.get(t.project_id);
    if (!project) continue;
    if (params.side === "agency") {
      counterpartyIds.add(project.customer_id);
    }
  }

  const nameById = new Map<string, string>();
  if (counterpartyIds.size > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", Array.from(counterpartyIds));
    for (const p of profiles ?? []) {
      nameById.set(p.id, p.full_name ?? p.email.split("@")[0]);
    }
  }

  // For customer side, counterparty is the tenant — fetch tenant names
  const tenantIds = Array.from(
    new Set(
      Array.from(threads.values())
        .map((t) => {
          // find tenant_id from any message in this thread
          const m = messages.find(
            (msg) => (msg.bid_id ?? msg.project_id) === (t.bid_id ?? t.project_id),
          );
          return m?.tenant_id ?? null;
        })
        .filter((id): id is string => id != null),
    ),
  );
  const tenantNameById = new Map<string, string>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await admin
      .from("tenants")
      .select("id, name")
      .in("id", tenantIds);
    for (const t of tenants ?? []) {
      tenantNameById.set(t.id, t.name);
    }
  }

  // Build final list
  const conversations: Conversation[] = [];
  for (const [key, thread] of threads.entries()) {
    const project = projectById.get(thread.project_id);
    if (!project) continue;

    // Pick counterparty name based on side
    let counterpartyName = "Ukjent";
    if (params.side === "agency") {
      counterpartyName = nameById.get(project.customer_id) ?? "Kunde";
    } else {
      // Find tenant_id from a message in this thread
      const m = messages.find(
        (msg) => (msg.bid_id ?? msg.project_id) === key,
      );
      const tid = m?.tenant_id ?? null;
      counterpartyName = tid
        ? (tenantNameById.get(tid) ?? "Byrå")
        : "Byrå";
    }

    // Build href to the relevant detail page
    const href =
      params.side === "agency"
        ? `/byraa/leads/${thread.project_id}`
        : thread.channel === "bid" && thread.bid_id
          ? `/kunde/tilbud/${thread.bid_id}`
          : `/kunde/prosjekter/${thread.project_id}`;

    conversations.push({
      thread_key: key,
      channel: thread.channel,
      project_id: thread.project_id,
      bid_id: thread.bid_id,
      project_title: project.title,
      counterparty_name: counterpartyName,
      last_message_body: thread.latest.body,
      last_message_at: thread.latest.created_at,
      last_sender_is_me: thread.latest.sender_id === params.userId,
      unread_count: thread.unread_count,
      href,
    });
  }

  conversations.sort(
    (a, b) =>
      new Date(b.last_message_at).getTime() -
      new Date(a.last_message_at).getTime(),
  );

  return conversations;
}
