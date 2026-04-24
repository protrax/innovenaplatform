import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

export default async function KundeProsjekter() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Mine prosjekter</h2>
        <Button asChild variant="brand">
          <Link href="/kunde/prosjekter/ny">
            <Plus className="h-4 w-4" /> Ny forespørsel
          </Link>
        </Button>
      </div>

      {!projects || projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen prosjekter ennå</CardTitle>
            <CardDescription>
              Lag din første forespørsel og motta tilbud fra relevante byråer.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <CardDescription>
                      Opprettet {formatDate(p.created_at)}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{p.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {p.description}
                </p>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/kunde/prosjekter/${p.id}`}>Åpne</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
