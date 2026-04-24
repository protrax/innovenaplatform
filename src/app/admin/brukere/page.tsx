import { requireRole } from "@/lib/auth";
import { listUsers } from "@/lib/admin/users";
import { UsersTable } from "./users-table";
import type { UserRole } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type Search = Promise<{ q?: string; role?: UserRole }>;

export default async function AdminBrukerePage({
  searchParams,
}: {
  searchParams: Search;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const { users } = await listUsers({ search: sp.q, role: sp.role, limit: 200 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Brukere</h2>
        <p className="text-sm text-muted-foreground">
          Alle registrerte brukere, roller, tenant-medlemskap og handlinger.
        </p>
      </div>
      <UsersTable users={users} currentQuery={sp.q ?? ""} currentRole={sp.role ?? ""} />
    </div>
  );
}
