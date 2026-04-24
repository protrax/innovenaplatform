import Link from "next/link";
import type { AuthenticatedUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export function AppShell({
  user,
  nav,
  heading,
  subheading,
  headerRight,
  children,
  currentPath,
}: {
  user: AuthenticatedUser;
  nav: NavItem[];
  heading?: string;
  subheading?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  currentPath?: string;
}) {
  const initials = (user.fullName ?? user.email ?? "")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen flex-1 bg-[#fbf7f0]">
      {/* =====================================================
          SIDEBAR — warm dark with coral accents on active
      ====================================================== */}
      <aside className="hidden w-60 shrink-0 flex-col bg-[#14100e] text-[#f6f1ea] md:flex">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 px-5 text-sm font-semibold tracking-tight">
          <span
            className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-[#ff7849] to-[#c84a1f] shadow-sm shadow-[#ff7849]/30"
            aria-hidden
          />
          Innovena
        </div>

        {/* Tenant/subheader context if passed */}
        {subheading ? (
          <div className="mx-3 mb-3 rounded-md bg-white/5 px-3 py-2 text-[11px] text-white/60">
            {subheading}
          </div>
        ) : null}

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((item) => {
            const active =
              currentPath === item.href ||
              (item.href !== "/" && currentPath?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[#ff7849]/15 text-[#ffb094]"
                    : "text-white/65 hover:bg-white/5 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 transition-colors",
                    active ? "text-[#ff9975]" : "text-white/50 group-hover:text-white",
                  )}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User chip */}
        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#ff7849] to-[#c84a1f] text-xs font-semibold text-white">
              {initials || "·"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-white">
                {user.fullName ?? user.email.split("@")[0]}
              </div>
              <div className="truncate text-[10px] text-white/40">
                {user.email}
              </div>
            </div>
            <form action="/api/auth/sign-out" method="post">
              <button
                type="submit"
                aria-label="Logg ut"
                className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* =====================================================
          MAIN CONTENT AREA — min-w-0 prevents kanban-like wide
          content from pushing the whole page horizontally.
      ====================================================== */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#14100e]/8 bg-[#fbf7f0] px-6">
          <div>
            {heading ? (
              <h1 className="text-lg font-semibold text-[#14100e]">{heading}</h1>
            ) : null}
            {subheading && !heading ? (
              <p className="text-xs text-[#64594f]">{subheading}</p>
            ) : null}
          </div>
          <div>{headerRight}</div>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
