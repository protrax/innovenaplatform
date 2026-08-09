import { createClient } from "@/lib/supabase/server";
import type { ServiceCategory } from "@/lib/supabase/types";
import { CategoryEditor } from "./category-editor";

export default async function AdminKategorierPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("service_categories")
    .select("*")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Kategorier</h2>
        <p className="text-sm text-muted-foreground">
          Tjenestekategorier som brukes for matching og filtrering, og som
          bestemmer hvor mange byråer hver forespørsel fordeles til.
        </p>
      </div>
      <CategoryEditor categories={(categories ?? []) as ServiceCategory[]} />
    </div>
  );
}
