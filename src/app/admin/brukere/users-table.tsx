"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Search, ExternalLink } from "lucide-react";
import type { AdminUserRow } from "@/lib/admin/users";

const ROLE_FILTERS = [
  { value: "", label: "Alle" },
  { value: "admin", label: "Admin" },
  { value: "agency_member", label: "Byrå" },
  { value: "consultant", label: "Konsulent" },
  { value: "customer", label: "Kunde" },
];

export function UsersTable({
  users,
  currentQuery,
  currentRole,
}: {
  users: AdminUserRow[];
  currentQuery: string;
  currentRole: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(currentQuery);
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      router.push(`/admin/brukere?${next.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateParam("q", q);
          }}
          className="flex flex-1 items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk e-post eller navn"
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="outline">
            Søk
          </Button>
        </form>
        <div className="flex flex-wrap gap-1">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r.value || "all"}
              type="button"
              onClick={() => updateParam("role", r.value)}
              className={
                currentRole === r.value
                  ? "rounded-md border border-brand bg-brand/10 px-2.5 py-1 text-xs font-medium"
                  : "rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground/30"
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingen treff</CardTitle>
            <CardDescription>
              Prøv å justere søket eller rollefilteret.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Bruker</th>
                    <th className="px-4 py-2 text-left font-medium">Roller</th>
                    <th className="px-4 py-2 text-left font-medium">Tenants</th>
                    <th className="px-4 py-2 text-left font-medium">Opprettet</th>
                    <th className="px-4 py-2 text-left font-medium">Sist inn</th>
                    <th className="px-4 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-border last:border-b-0 hover:bg-accent/30"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {u.full_name ?? u.email.split("@")[0]}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {u.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              Ingen
                            </span>
                          ) : (
                            u.roles.map((r) => (
                              <Badge
                                key={r}
                                variant={r === "admin" ? "brand" : "secondary"}
                                className="text-[10px]"
                              >
                                {r}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {u.tenants.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            u.tenants.map((t) => (
                              <span key={t.id}>
                                {t.name}{" "}
                                <span className="text-muted-foreground">
                                  ({t.role})
                                </span>
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {u.last_sign_in_at
                          ? formatDate(u.last_sign_in_at)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/brukere/${u.id}`}>
                            Åpne <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Viser {users.length} brukere.
      </p>
    </div>
  );
}
