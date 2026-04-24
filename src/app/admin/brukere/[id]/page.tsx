import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getUserDetail } from "@/lib/admin/users";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { UserActions } from "./user-actions";

export const dynamic = "force-dynamic";

export default async function AdminUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentAdmin = await requireRole("admin");
  const user = await getUserDetail(id);
  if (!user) notFound();

  const hasTenant = user.tenants.length > 0;
  const hasTenantIntent =
    user.user_metadata &&
    typeof user.user_metadata === "object" &&
    "role" in user.user_metadata &&
    "company_name" in user.user_metadata;
  const needsRepair = !hasTenant && hasTenantIntent;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/brukere"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Tilbake til brukere
        </Link>
        <h2 className="mt-1 text-2xl font-semibold">
          {user.full_name ?? user.email.split("@")[0]}
        </h2>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      {needsRepair ? (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-base">
              Signup ble aldri fullført
            </CardTitle>
            <CardDescription>
              Brukeren har signup-intensjon i user_metadata, men ingen tenant.
              Kjør reparering for å opprette tenant + rolle idempotent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserActions
              userId={user.id}
              isSelf={user.id === currentAdmin.id}
              currentRoles={user.roles}
              showRepair
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Prosjekter" value={user.projects_count} />
        <StatCard label="Bud innlevert" value={user.bids_count} />
        <StatCard label="Kontrakter" value={user.contracts_count} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">E-post</div>
            <div>{user.email}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Navn</div>
            <div>{user.full_name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Telefon</div>
            <div>{user.phone ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Registrert</div>
            <div>{formatDate(user.created_at)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Sist innlogget</div>
            <div>
              {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "Aldri"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <div>
              {user.banned ? (
                <Badge variant="destructive">Suspendert</Badge>
              ) : (
                <Badge variant="secondary">Aktiv</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenant-medlemskap</CardTitle>
          <CardDescription>
            Selskaper denne brukeren tilhører.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.tenants.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Ingen tenant-medlemskap.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {user.tenants.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Rolle: {t.role}
                    </div>
                  </div>
                  <Link
                    href={`/byraaer/${t.slug}`}
                    target="_blank"
                    className="text-xs text-brand underline-offset-2 hover:underline"
                  >
                    Offentlig profil →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roller og handlinger</CardTitle>
          <CardDescription>
            Globale rolletildelinger og admin-handlinger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserActions
            userId={user.id}
            isSelf={user.id === currentAdmin.id}
            currentRoles={user.roles}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
