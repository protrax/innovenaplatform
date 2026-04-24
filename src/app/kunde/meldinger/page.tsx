import { requireUser } from "@/lib/auth";
import { fetchInbox } from "@/lib/inbox";
import { InboxList } from "@/components/inbox-list";

export const dynamic = "force-dynamic";

export default async function KundeMeldinger() {
  const user = await requireUser();

  const conversations = await fetchInbox({
    userId: user.id,
    side: "customer",
  });

  const unread = conversations.reduce((n, c) => n + c.unread_count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Meldinger</h2>
        <p className="text-sm text-muted-foreground">
          Samtaler med byråer på prosjektene dine.
          {unread > 0 ? ` · ${unread} uleste meldinger` : ""}
        </p>
      </div>
      <InboxList
        conversations={conversations}
        emptyMessage="Send inn et prosjekt og motta tilbud — du kan stille spørsmål til byråene direkte her."
      />
    </div>
  );
}
