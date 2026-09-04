/**
 * Oppslag av foretak i offentlige registre, per land.
 *
 * Bakgrunn: registreringen krevde ni siffer og slo opp i Enhetsregisteret.
 * Det stengte ute nordiske byraaer som jobber mot det norske markedet — en
 * svensk influencer-aktoer med norske kunder kom ikke inn i det hele tatt.
 * Supply er flaskehalsen i markedsplassen, ikke etterspoerselen, sa det er
 * dyrt a avvise et kvalifisert byraa pa formatet til et tall.
 *
 * Norge slaar fortsatt opp i Enhetsregisteret, som gir mest: selskapsform,
 * naeringskode, konkursstatus. For Sverige brukes EUs VIES-register, som er
 * den naermeste offisielle parallellen — gratis, uten noekkel, og det svarer
 * bare for foretak som faktisk er momsregistrert og aktive.
 *
 * Landet utledes senere fra antall siffer (NO = 9, SE = 10). Det holder sa
 * lenge vi bare stotter disse to. Legges Danmark (8) eller Finland (8) til,
 * kolliderer de med hverandre, og da maa `tenants` fa en egen land-kolonne.
 */

export type LandKode = 'NO' | 'SE'

export interface Land {
  kode: LandKode
  navn: string
  /** Antall siffer i organisasjonsnummeret. */
  siffer: number
  /** Vises i inntastingsfeltet. */
  plassholder: string
  /** Hva registeret heter, brukt i feilmeldinger og hjelpetekst. */
  register: string
}

export const LAND: Record<LandKode, Land> = {
  NO: {
    kode: 'NO',
    navn: 'Norge',
    siffer: 9,
    plassholder: '9 siffer',
    register: 'Enhetsregisteret',
  },
  SE: {
    kode: 'SE',
    navn: 'Sverige',
    siffer: 10,
    plassholder: '10 siffer (556703-7485)',
    register: 'EUs momsregister (VIES)',
  },
}

export interface Foretak {
  orgnr: string
  land: LandKode
  name: string
  form: string | null
  formLabel: string | null
  industry: string | null
  location: string | null
  website: string | null
}

export interface Feil {
  error: string
  status: number
}

export function erFeil(v: Foretak | Feil): v is Feil {
  return 'error' in v
}

/** Utleder land fra antall siffer. Se merknaden om Danmark/Finland over. */
export function landFor(orgnr: string | null): LandKode | null {
  const d = (orgnr ?? '').replace(/\D/g, '')
  if (d.length === 9) return 'NO'
  if (d.length === 10) return 'SE'
  return null
}

/** Lenke til det offentlige registeret, for oppslag i admin. */
export function registerLenke(orgnr: string | null): string | null {
  const d = (orgnr ?? '').replace(/\D/g, '')
  const land = landFor(d)
  if (land === 'NO') return `https://virksomhet.brreg.no/nb/oppslag/enheter/${d}`
  if (land === 'SE') return `https://www.allabolag.se/${d.slice(0, 6)}-${d.slice(6)}`
  return null
}

// ── Norge: Enhetsregisteret ───────────────────────────────────────────────
async function slaaOppNorge(orgnr: string): Promise<Foretak | Feil> {
  const res = await fetch(
    `https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`,
    { headers: { accept: 'application/json' }, next: { revalidate: 86400 } },
  )

  if (res.status === 404) {
    return {
      error:
        'Fant ikke dette organisasjonsnummeret i Enhetsregisteret. Sjekk at det er riktig.',
      status: 404,
    }
  }
  if (!res.ok) {
    return { error: 'Enhetsregisteret svarte ikke. Prøv igjen om litt.', status: 502 }
  }

  const d = await res.json()

  if (d.konkurs || d.underAvvikling || d.underTvangsavviklingEllerTvangsopplosning) {
    return {
      error:
        'Dette foretaket står som konkurs eller under avvikling i Enhetsregisteret, og kan ikke registreres.',
      status: 422,
    }
  }

  return {
    orgnr,
    land: 'NO',
    name: d.navn as string,
    form: d.organisasjonsform?.kode ?? null,
    formLabel: d.organisasjonsform?.beskrivelse ?? null,
    industry: d.naeringskode1?.beskrivelse ?? null,
    location: d.forretningsadresse?.poststed ?? null,
    website: d.hjemmeside ?? null,
  }
}

// ── Sverige: VIES ─────────────────────────────────────────────────────────
/**
 * Svensk momsnummer er organisasjonsnummeret pluss «01» pa slutten.
 * VIES svarer med isValid, navn og adresse. Et foretak som ikke er
 * momsregistrert — eller er avviklet — svarer isValid: false, og fungerer
 * dermed som samme filter som konkurssjekken gjor for Norge.
 */
async function slaaOppSverige(orgnr: string): Promise<Foretak | Feil> {
  const res = await fetch(
    `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/SE/vat/${orgnr}01`,
    { headers: { accept: 'application/json' }, next: { revalidate: 86400 } },
  )

  if (!res.ok) {
    return {
      error: 'Det europeiske momsregisteret svarte ikke. Prøv igjen om litt.',
      status: 502,
    }
  }

  const d = await res.json()

  if (!d.isValid) {
    return {
      error:
        'Fant ikke dette organisasjonsnummeret som aktivt momsregistrert foretak i Sverige. Sjekk at det er riktig.',
      status: 404,
    }
  }

  // Adressen kommer som «GATE 1 \n111 53 STOCKHOLM». Byen er siste ord pa
  // siste linje som ikke er postnummer.
  const linjer = String(d.address ?? '')
    .split('\n')
    .map((l: string) => l.trim())
    .filter(Boolean)
  const sisteLinje = linjer[linjer.length - 1] ?? ''
  const poststed = sisteLinje.replace(/^\d[\d\s]*/, '').trim() || null

  return {
    orgnr,
    land: 'SE',
    name: String(d.name ?? '').trim(),
    form: null,
    formLabel: null,
    industry: null,
    location: poststed,
    website: null,
  }
}

export async function slaaOppForetak(
  orgnrRaa: string,
  land: LandKode,
): Promise<Foretak | Feil> {
  const orgnr = orgnrRaa.replace(/\D/g, '')
  const konfig = LAND[land]

  if (orgnr.length !== konfig.siffer) {
    return {
      error: `Organisasjonsnummer i ${konfig.navn} har ${konfig.siffer} siffer.`,
      status: 400,
    }
  }

  try {
    return land === 'SE' ? await slaaOppSverige(orgnr) : await slaaOppNorge(orgnr)
  } catch {
    return { error: `Kunne ikke nå ${konfig.register}. Prøv igjen om litt.`, status: 502 }
  }
}
