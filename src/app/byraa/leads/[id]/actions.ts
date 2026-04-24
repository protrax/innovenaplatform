"use server";

import { createClient } from "@/lib/supabase/server";

export async function markLeadViewed(leadId: string) {
  const supabase = await createClient();
  await supabase
    .from("project_leads")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", leadId);
}
