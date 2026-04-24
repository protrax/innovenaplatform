"use server";

import { createClient } from "@/lib/supabase/server";

export async function markBidViewed(bidId: string) {
  const supabase = await createClient();
  await supabase
    .from("bids")
    .update({ status: "viewed" })
    .eq("id", bidId)
    .eq("status", "sent");
}
