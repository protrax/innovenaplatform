import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STEG_NAVN: Record<number, string> = {
  1: "Beskriv behovet",
  2: "Bekreft fagområde",
  3: "Mål og omfang",
  4: "Budsjett og tid",
  5: "Kontakt og innsending",
};

/**
 * Trakten for den offentlige veiviseren.
 *
 * Plattformen hadde ingen maling: vi sa bare de som kom helt gjennom, og
 * kunne ikke svare pa det mest grunnleggende sporsmalet — hvor faller folk av.
 * Denne siden leser wizard_events og viser det.
 *
 * Tallene starter pa null 22. august 2026. Alt for det er ikke malt.
 */
export default async function TraktPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: hendelser }, { count: prosjekter }, { data: fangede }] =
    await Promise.all([
    admin
      .from("wizard_events")
      .select("session_id, step, source, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
      admin.from("projects").select("id", { count: "exact", head: true }),
      // De som ga fra seg kontaktinfo i steg 2 men aldri publiserte. Disse
      // ville vart tapt for — de er hele grunnen til at fangsten ble flyttet.
      admin
        .from("lead_captures")
        .select("email, full_name, phone, user_input, source, highest_step, created_at")
        .is("project_id", null)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const rader = hendelser ?? [];
  const apne = fangede ?? [];

  // Hoyeste naadde steg per okt — det er det som gir trakten.
  const hoyeste = new Map<string, number>();
  const kilde = new Map<string, string>();
  for (const r of rader) {
    const n = hoyeste.get(r.session_id) ?? 0;
    if (r.step > n) hoyeste.set(r.session_id, r.step);
    if (r.source && !kilde.has(r.session_id)) kilde.set(r.session_id, r.source);
  }

  const okter = hoyeste.size;
  const naaddeSteg = (s: number) =>
    [...hoyeste.values()].filter((h) => h >= s).length;

  // Hvilke sider pa innovena.no sender folk hit, og hvor langt de kommer.
  const perKilde = new Map<string, { okter: number; fullfort: number }>();
  for (const [sesjon, h] of hoyeste) {
    const k = kilde.get(sesjon) ?? "(ukjent)";
    const rad = perKilde.get(k) ?? { okter: 0, fullfort: 0 };
    rad.okter += 1;
    if (h >= 5) rad.fullfort += 1;
    perKilde.set(k, rad);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Trakt</h2>
        <p className="text-sm text-muted-foreground">
          Hvor mange starter en forespørsel, og hvor faller de av. Målingen
          startet 22. august 2026 — alt før det er ikke registrert.
        </p>
      </div>

      {okter === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen økter registrert ennå</CardTitle>
            <CardDescription>
              Første besøkende som åpner veiviseren dukker opp her. Totalt{" "}
              {prosjekter ?? 0} forespørsler er sendt inn siden oppstart.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{okter} økter</CardTitle>
              <CardDescription>
                {naaddeSteg(5)} nådde siste steg —{" "}
                {Math.round((naaddeSteg(5) / okter) * 100)} % av dem som startet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3, 4, 5].map((s) => {
                const n = naaddeSteg(s);
                const pst = Math.round((n / okter) * 100);
                const forrige = s > 1 ? naaddeSteg(s - 1) : okter;
                const tapt = forrige - n;
                return (
                  <div key={s}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">
                        {s}. {STEG_NAVN[s]}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {n} ({pst} %)
                        {s > 1 && tapt > 0 ? (
                          <span className="ml-2 text-destructive">
                            −{tapt}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded bg-muted">
                      <div
                        className="h-2 rounded bg-brand"
                        style={{ width: `${pst}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hvilke sider sender folk hit</CardTitle>
              <CardDescription>
                Fra source-parameteren. Viser hvilke sider på innovena.no som
                faktisk produserer forespørsler — ikke bare trafikk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...perKilde.entries()]
                  .sort((a, b) => b[1].okter - a[1].okter)
                  .slice(0, 20)
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-baseline justify-between border-b border-border/60 py-2 text-sm last:border-0"
                    >
                      <span className="font-mono text-xs">{k}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {v.okter} startet · {v.fullfort} fullførte
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Ga fra seg kontaktinfo, men fullførte ikke ({apne.length})
          </CardTitle>
          <CardDescription>
            Fanget i steg 2. Fram til 22. august ble disse borte — veiviseren
            spurte om kontaktinfo først i steg 5, så alt som falt av underveis
            forsvant. Dette er folk det går an å ringe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apne.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ingen ennå. Første som fyller ut steg 2 uten å fullføre dukker opp
              her.
            </p>
          ) : (
            <div className="space-y-3">
              {apne.map((l) => (
                <div
                  key={`${l.email}-${l.created_at}`}
                  className="border-b border-border/60 pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-sm font-medium">
                      {l.full_name || "(uten navn)"}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      kom til steg {l.highest_step} ·{" "}
                      {new Date(l.created_at).toLocaleDateString("nb-NO")}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <a
                      href={`mailto:${l.email}`}
                      className="underline underline-offset-2"
                    >
                      {l.email}
                    </a>
                    {l.phone ? (
                      <>
                        {" · "}
                        <a
                          href={`tel:${l.phone}`}
                          className="underline underline-offset-2"
                        >
                          {l.phone}
                        </a>
                      </>
                    ) : null}
                  </div>
                  {l.user_input ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {l.user_input}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
