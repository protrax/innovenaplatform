import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Slår opp et organisasjonsnummer i Enhetsregisteret under registrering.
 *
 * To grunner: det gjør påmeldingen lettere (ni siffer i stedet for å skrive
 * firmanavn, adresse og selskapsform), og det gjør den strengere — vi får
 * det offisielle navnet i stedet for «TBD», og vi ser om selskapet er konkurs
 * eller under avvikling før noen slipper inn i katalogen.
 *
 * Åpent endepunkt fordi det brukes før innlogging. Dataene er offentlige.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("orgnr") ?? "";
  const orgnr = raw.replace(/\D/g, "");

  if (orgnr.length !== 9) {
    return NextResponse.json(
      { error: "Organisasjonsnummer må være ni siffer." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`,
      { headers: { accept: "application/json" }, next: { revalidate: 86400 } },
    );

    if (res.status === 404) {
      return NextResponse.json(
        {
          error:
            "Fant ikke dette organisasjonsnummeret i Enhetsregisteret. Sjekk at det er riktig.",
        },
        { status: 404 },
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: "Enhetsregisteret svarte ikke. Prøv igjen om litt." },
        { status: 502 },
      );
    }

    const d = await res.json();

    if (d.konkurs || d.underAvvikling || d.underTvangsavviklingEllerTvangsopplosning) {
      return NextResponse.json(
        {
          error:
            "Dette foretaket står som konkurs eller under avvikling i Enhetsregisteret, og kan ikke registreres.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      orgnr,
      name: d.navn as string,
      form: d.organisasjonsform?.kode ?? null,
      formLabel: d.organisasjonsform?.beskrivelse ?? null,
      industry: d.naeringskode1?.beskrivelse ?? null,
      location: d.forretningsadresse?.poststed ?? null,
      website: d.hjemmeside ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Kunne ikke nå Enhetsregisteret. Prøv igjen om litt." },
      { status: 502 },
    );
  }
}
