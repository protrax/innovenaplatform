import { NextResponse } from "next/server";
import { LAND, erFeil, slaaOppForetak, type LandKode } from "@/lib/foretaksregister";

export const runtime = "nodejs";

/**
 * Slår opp et organisasjonsnummer i et offentlig foretaksregister.
 *
 * To grunner: det gjør påmeldingen lettere (siffer i stedet for å skrive
 * firmanavn, adresse og selskapsform), og det gjør den strengere — vi får
 * det offisielle navnet i stedet for «TBD», og vi ser om selskapet er konkurs
 * eller under avvikling før noen slipper inn i katalogen.
 *
 * Norge slås opp i Enhetsregisteret, Sverige i EUs momsregister. Registeret
 * velges av `land`-parameteren; uten den antas Norge, slik at gamle lenker
 * og bokmerker fortsatt virker.
 *
 * Åpent endepunkt fordi det brukes før innlogging. Dataene er offentlige.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("orgnr") ?? "";
  const landParam = (url.searchParams.get("land") ?? "NO").toUpperCase();

  if (!(landParam in LAND)) {
    return NextResponse.json(
      { error: "Ukjent land. Velg Norge eller Sverige." },
      { status: 400 },
    );
  }

  const svar = await slaaOppForetak(raw, landParam as LandKode);

  if (erFeil(svar)) {
    return NextResponse.json({ error: svar.error }, { status: svar.status });
  }

  return NextResponse.json(svar);
}
