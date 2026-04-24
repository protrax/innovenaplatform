import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";
import {
  LayoutDashboard,
  Inbox,
  KanbanSquare,
  Users,
  Clock,
  MessageSquare,
  CreditCard,
  Sparkles,
  Settings,
  Building2,
  Contact,
  FolderKanban,
} from "lucide-react";

export default async function ByraaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const isConsultantOrAgency =
    user.roles.includes("agency_member") ||
    user.roles.includes("consultant") ||
    user.roles.includes("admin");

  if (!isConsultantOrAgency) {
    redirect("/");
  }

  // Agency / consultant users without a tenant mean provisioning never
  // completed. Route them to /velkommen where they can finish setup, instead
  // of landing on broken inner pages that bail out with "Ingen tenant".
  if (user.tenantIds.length === 0 && !user.roles.includes("admin")) {
    redirect("/velkommen");
  }

  // Fetch first tenant for display (a user may own/belong to multiple — tenant
  // switcher comes in fase 2)
  const supabase = await createClient();
  const { data: tenant } = user.tenantIds.length
    ? await supabase
        .from("tenants")
        .select("name, type, status")
        .eq("id", user.tenantIds[0])
        .maybeSingle()
    : { data: null };

  const isAgency = tenant?.type === "agency";

  return (
    <AppShell
      user={user}
      subheading={tenant ? `${tenant.name} · ${tenant.status}` : undefined}
      nav={[
        {
          label: "Oversikt",
          href: "/byraa",
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
        {
          label: "Leads",
          href: "/byraa/leads",
          icon: <Inbox className="h-4 w-4" />,
        },
        {
          label: "Pipeline",
          href: "/byraa/pipeline",
          icon: <KanbanSquare className="h-4 w-4" />,
        },
        {
          label: "Prosjekter",
          href: "/byraa/prosjekter",
          icon: <FolderKanban className="h-4 w-4" />,
        },
        {
          label: "Kontakter",
          href: "/byraa/kontakter",
          icon: <Contact className="h-4 w-4" />,
        },
        {
          label: "Timeføring",
          href: "/byraa/timefoering",
          icon: <Clock className="h-4 w-4" />,
        },
        ...(isAgency
          ? [
              {
                label: "Konsulenter",
                href: "/byraa/konsulenter",
                icon: <Users className="h-4 w-4" />,
              },
            ]
          : []),
        {
          label: "Meldinger",
          href: "/byraa/meldinger",
          icon: <MessageSquare className="h-4 w-4" />,
        },
        {
          label: "Abonnement",
          href: "/byraa/abonnement",
          icon: <CreditCard className="h-4 w-4" />,
        },
        {
          label: "Markedsføring",
          href: "/byraa/markedsforing",
          icon: <Sparkles className="h-4 w-4" />,
        },
        {
          label: "Offentlig profil",
          href: "/byraa/profil",
          icon: <Building2 className="h-4 w-4" />,
        },
        {
          label: "Innstillinger",
          href: "/byraa/innstillinger",
          icon: <Settings className="h-4 w-4" />,
        },
      ]}
    >
      {children}
    </AppShell>
  );
}
