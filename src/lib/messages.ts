import { createClient } from "@/lib/supabase/server";

// Mark all received messages in a thread as read for the current user.
// Call from server components (layouts/pages) when a user opens a thread.
export async function markThreadRead(params: {
  projectId?: string;
  bidId?: string;
  userId: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .neq("sender_id", params.userId);

  if (params.bidId) {
    query = query.eq("bid_id", params.bidId);
  } else if (params.projectId) {
    query = query.eq("project_id", params.projectId);
  } else {
    return;
  }

  await query;
}

export interface ConversationSummary {
  thread_key: string;
  channel: "project" | "bid" | "contract";
  project_id: string;
  bid_id: string | null;
  project_title: string;
  counterparty_name: string;
  counterparty_type: "agency" | "customer";
  last_message_body: string;
  last_message_at: string;
  last_sender_is_me: boolean;
  unread_count: number;
}
