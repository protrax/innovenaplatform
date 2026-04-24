import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ContactsClient } from "./contacts-client";

export const dynamic = "force-dynamic";

export default async function KontakterPage() {
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  if (!tenantId) {
    return <p className="text-sm text-muted-foreground">Ingen tenant funnet.</p>;
  }
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select(
      "id, full_name, email, phone, company, tags, notes, source, lifecycle_stage, created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Kontakter</h2>
        <p className="text-sm text-muted-foreground">
          Alle som står i adresseboken deres — leads, kunder, nyhetsbrev-
          abonnenter. Kommer inn via skjema, webhook eller manuelt.
        </p>
      </div>
      <ContactsClient initialContacts={contacts ?? []} />
    </div>
  );
}
