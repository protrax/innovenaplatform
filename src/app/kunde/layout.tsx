import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";
import { Briefcase, Inbox, MessageSquare, Settings } from "lucide-react";

export default async function KundeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell
      user={user}
      nav={[
        {
          label: "Oversikt",
          href: "/kunde",
          icon: <Inbox className="h-4 w-4" />,
        },
        {
          label: "Mine prosjekter",
          href: "/kunde/prosjekter",
          icon: <Briefcase className="h-4 w-4" />,
        },
        {
          label: "Meldinger",
          href: "/kunde/meldinger",
          icon: <MessageSquare className="h-4 w-4" />,
        },
        {
          label: "Innstillinger",
          href: "/kunde/innstillinger",
          icon: <Settings className="h-4 w-4" />,
        },
      ]}
    >
      {children}
    </AppShell>
  );
}
