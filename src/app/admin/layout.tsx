import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";
import {
  LayoutDashboard,
  Building2,
  Tag,
  Users,
  Settings,
} from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("admin");

  return (
    <AppShell
      user={user}
      subheading="Admin"
      nav={[
        {
          label: "Oversikt",
          href: "/admin",
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
        {
          label: "Byråer",
          href: "/admin/byraaer",
          icon: <Building2 className="h-4 w-4" />,
        },
        {
          label: "Brukere",
          href: "/admin/brukere",
          icon: <Users className="h-4 w-4" />,
        },
        {
          label: "Kategorier",
          href: "/admin/kategorier",
          icon: <Tag className="h-4 w-4" />,
        },
        {
          label: "Innstillinger",
          href: "/admin/innstillinger",
          icon: <Settings className="h-4 w-4" />,
        },
      ]}
    >
      {children}
    </AppShell>
  );
}
