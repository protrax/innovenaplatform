import { requireUser } from "@/lib/auth";
import { fetchInbox } from "@/lib/inbox";
import { InboxList } from "@/components/inbox-list";

export const dynamic = "force-dynamic";

export default async function ByraaMeldinger() {
  const user = await requireUser();
  const tenantId = user.tenantIds[0];
  if (!tenantId) {
    return (
      <p className="text-sm text-muted-foreground">Ingen tenant funnet.</p>
    );
  }

  const conversations = await fetchInbox({
    userId: user.id,
    side: "agency",
    tenantId,
  });

  const unread = conversations.reduce((n, c) => n + c.unread_count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Meldinger</h2>
        <p className="text-sm text-muted-foreground">
          Alle samtaler med kunder på leads og tilbud.
          {unread > 0
            ? ` · ${unread} uleste meldinger`
            : ""}
        </p>
      </div>
      <InboxList
        conversations={conversations}
        emptyMessage="Når kunder sender deg spørsmål på tilbud eller prosjekter dukker de opp her."
      />
    </div>
  );
}
