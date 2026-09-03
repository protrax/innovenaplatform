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

/*
  Steg 1 het «Beskriv behovet», og det var feil.

  Veiviseren starter i state.step = 1, og sporingen fyrer i det komponenten
  monteres. Steg 1 teller derfor hver eneste SIDEVISNING av veiviseren —
  ogsa den som lukker fanen etter to sekunder, og hver robot som kjorer
  JavaScript. Det fikk trakten til a vise «54 okter, 1 fullforte = 2 %», som
  leses som en katastrofe.

  Det ekte startsignalet er steg 2: dit kommer man forst nar beskrivelsen er
  sendt inn, enten manuelt eller ved auto-fremrykk fra innovena.no. Navnene
  under sier na hva tallene faktisk maler.
*/
const STEG_NAVN: Record<number, string> = {
  0: "Åpnet skjemaet på innovena.no",
  1: "Åpnet veiviseren (sidevisning)",
  2: "Beskrev behovet og gikk videre",
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

/** Feltene kortet viser. Alt vi vet om en som ikke kom i mal. */
interface Fangst {
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  user_input: string | null;
  source: string | null;
  service: string | null;
  category_slugs: string[] | null;
  highest_step: number | null;
  fanget_paa: string | null;
  session_id: string | null;
  created_at: string;
  varsel_sendt_at?: string | null;
  paaminnelse_sendt_at?: string | null;
}

/**
 * Henter apne fangster.
 *
 * varsel_sendt_at og paaminnelse_sendt_at kommer av migrasjon 17. Kjores
 * koden for migrasjonen, feiler sporringen pa ukjente kolonner — og da skal
 * sida fortsatt vise leadene, som er det viktige. Derfor et forsok til uten
 * de to feltene.
 */
async function hentApneFangster(): Promise<{ data: Fangst[] | null }> {
  const admin = createAdminClient();
  const felter =
    "email, full_name, company, phone, user_input, source, service, category_slugs, highest_step, fanget_paa, session_id, created_at";

  const forsok = await admin
    .from("lead_captures")
    .select(`${felter}, varsel_sendt_at, paaminnelse_sendt_at`)
    .is("project_id", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!forsok.error) return { data: forsok.data as unknown as Fangst[] };

  const utenNye = await admin
    .from("lead_captures")
    .select(felter)
    .is("project_id", null)
    .order("created_at", { ascending: false })
    .limit(100);

  return { data: (utenNye.data ?? null) as unknown as Fangst[] | null };
}

/*
  Perioder. Trakten summerte alt fra 22. august og framover, for alltid.

  Det gjorde tallet uleselig: 44 av 54 okter kom fra en knapp som ble rettet
  26. august, og de blir liggende i nevneren for evig. Uansett hvor bra flyten
  blir, viser totalen «2 % fullforte». Med en periode kan man se hva som
  skjer NA, i stedet for gjennomsnittet av for og etter hver fiks.
*/
const PERIODER = [
  { nokkel: '7', navn: 'Siste 7 dager', dager: 7 },
  { nokkel: '14', navn: 'Siste 14 dager', dager: 14 },
  { nokkel: '30', navn: 'Siste 30 dager', dager: 30 },
  { nokkel: 'alt', navn: 'Alt siden 22. aug', dager: null as number | null },
] as const;

export default async function TraktPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode: valgt } = await searchParams;
  const periode = PERIODER.find((p) => p.nokkel === valgt) ?? PERIODER[1];
  const fra = periode.dager
    ? new Date(Date.now() - periode.dager * 86400000).toISOString()
    : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const hendelseSporring = admin
    .from("wizard_events")
    .select("session_id, step, source, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (fra) hendelseSporring.gte("created_at", fra);

  const [{ data: hendelser }, { count: prosjekter }, { data: fangede }] =
    await Promise.all([
    hendelseSporring,
      admin.from("projects").select("id", { count: "exact", head: true }),
      // De som ga fra seg kontaktinfo i steg 2 men aldri publiserte. Disse
      // ville vart tapt for — de er hele grunnen til at fangsten ble flyttet.
      hentApneFangster(),
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
          startet 22. august 2026 — alt før det er ikke registrert. Steg 1 er
          en sidevisning, ikke en handling: den ekte konverteringen er fra
          steg 2 og nedover.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {PERIODER.map((p) => (
            <a
              key={p.nokkel}
              href={`/admin/trakt?periode=${p.nokkel}`}
              className={
                p.nokkel === periode.nokkel
                  ? "rounded border border-foreground/20 bg-muted px-3 py-1 font-medium"
                  : "rounded border border-transparent px-3 py-1 text-muted-foreground hover:bg-muted/60"
              }
            >
              {p.navn}
            </a>
          ))}
        </div>
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
              {[0, 1, 2, 3, 4, 5].map((s) => {
                const n = naaddeSteg(s);
                const pst = Math.round((n / okter) * 100);
                const forrige = s > 0 ? naaddeSteg(s - 1) : okter;
                const tapt = forrige - n;
                return (
                  <div key={s}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">
                        {s === 0 ? "" : `${s}. `}
                        {STEG_NAVN[s]}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {n} ({pst} %)
                        {s > 0 && tapt > 0 ? (
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
            Fanget i skjemaet på innovena.no, før videresending. Fram til 23.
            august ble disse borte — kontaktinfoen ble først etterspurt i
            veiviseren, på et annet domene, og ingen kom så langt. Dette er
            folk det går an å ringe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apne.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ingen ennå. Første som sender inn skjemaet uten å fullføre
              veiviseren dukker opp her.
            </p>
          ) : (
            <div className="space-y-4">
              {apne.map((l) => (
                <div
                  key={l.session_id ?? `${l.email}-${l.created_at}`}
                  className="rounded-md border border-border/70 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-sm font-semibold">
                      {l.company || l.full_name || l.email}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("nb-NO", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Kontakt — det du trenger for a ta telefonen */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <a
                      href={`mailto:${l.email}`}
                      className="underline underline-offset-2"
                    >
                      {l.email}
                    </a>
                    {l.phone ? (
                      <a
                        href={`tel:${l.phone}`}
                        className="underline underline-offset-2"
                      >
                        {l.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">
                        ingen telefon oppgitt
                      </span>
                    )}
                    {l.full_name && l.company ? (
                      <span className="text-muted-foreground">
                        Kontakt: {l.full_name}
                      </span>
                    ) : null}
                  </div>

                  {/* Hele teksten, ikke to linjer. Den er ofte det mest
                      verdifulle vi har — den sier hva de faktisk vil ha. */}
                  {l.user_input ? (
                    <p className="mt-3 whitespace-pre-wrap rounded bg-muted/50 p-3 text-sm text-foreground/90">
                      {l.user_input}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Rakk ikke å beskrive behovet.
                    </p>
                  )}

                  {/* Kontekst: hvor de kom fra, hvor langt de kom, hva vi har
                      gjort med dem */}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Merke>
                      Kom til steg {l.highest_step ?? 2} av 5
                    </Merke>
                    <Merke>
                      {l.fanget_paa === "hero"
                        ? "Fanget i skjemaet på innovena.no"
                        : "Fanget i veiviseren"}
                    </Merke>
                    {l.source ? <Merke>Fra {l.source}</Merke> : null}
                    {l.service ? <Merke>Tjeneste: {l.service}</Merke> : null}
                    {(l.category_slugs ?? []).map((k) => (
                      <Merke key={k}>{k}</Merke>
                    ))}
                    {l.varsel_sendt_at ? (
                      <Merke tone="ok">Varslet deg</Merke>
                    ) : null}
                    {l.paaminnelse_sendt_at ? (
                      <Merke tone="ok">
                        Påminnelse sendt{" "}
                        {new Date(l.paaminnelse_sendt_at).toLocaleDateString(
                          "nb-NO",
                        )}
                      </Merke>
                    ) : (
                      <Merke tone="vent">Påminnelse ikke sendt ennå</Merke>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Liten etikett for konteksten rundt en fangst. */
function Merke({
  children,
  tone = "noytral",
}: {
  children: React.ReactNode;
  tone?: "noytral" | "ok" | "vent";
}) {
  const farge =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "vent"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-muted text-muted-foreground border-transparent";
  return (
    <span className={`rounded border px-2 py-0.5 ${farge}`}>{children}</span>
  );
}
