import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAiConfigured } from "@/lib/ai/client";
import { Wizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function NyProsjektPage() {
  await requireUser();
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("service_categories")
    .select("id, name, slug")
    .eq("active", true)
    .order("sort_order");

  return <Wizard categories={categories ?? []} aiEnabled={isAiConfigured()} />;
}
