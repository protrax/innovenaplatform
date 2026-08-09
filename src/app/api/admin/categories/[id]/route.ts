import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/api/admin/projects/admin-guard";

export const runtime = "nodejs";

/**
 * max_agencies_per_lead styrer hvor mange byråer som maks får den samme
 * forespørselen i kategorien.
 *
 * Under 1 ville betydd at ingen fikk leadet — kategorien hadde blitt et
 * svart hull der kundens forespørsel forsvant. Over 10 bryter løftet vi gir
 * kundene på forsiden om «maks fem tilbud»: da blir kunden nedringt, og de
 * byråene som faktisk betaler får en stadig tynnere sjanse per lead.
 */
const MIN_AGENCIES_PER_LEAD = 1;
const MAX_AGENCIES_PER_LEAD = 10;

const Body = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).nullable(),
    sort_order: z.number().int().min(0).max(9999),
    active: z.boolean(),
    max_agencies_per_lead: z
      .number()
      .int()
      .min(MIN_AGENCIES_PER_LEAD)
      .max(MAX_AGENCIES_PER_LEAD),
  })
  .partial()
  // Et tomt objekt er nesten alltid en klientfeil, ikke en tilsiktet no-op.
  .refine((v) => Object.keys(v).length > 0, {
    message: "Ingen felter å oppdatere",
  });

/**
 * Oppdaterer en tjenestekategori. Uten denne må admin inn i Supabase for å
 * endre navn, sortering eller distribusjonstaket.
 *
 * Merk: det finnes med vilje ingen DELETE her. Kategorier henger sammen med
 * tenant_categories og project_categories via ON DELETE CASCADE, så en
 * sletting ville dratt med seg både byråenes kategorivalg og historikken på
 * gamle forespørsler. Sett `active = false` i stedet — da forsvinner
 * kategorien fra skjema og matching, men historikken står.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (guard) return guard;

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Ugyldige verdier. Maks byråer per lead må være mellom 1 og 10.",
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("service_categories")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Fant ikke kategorien" }, { status: 404 });
  }

  const patch = parsed.data;
  const { data, error } = await admin
    .from("service_categories")
    .update({
      ...patch,
      // Tom beskrivelse skal bli null, ikke tom streng — ellers rendrer
      // kategorisidene en tom <p> i stedet for å hoppe over feltet.
      ...(patch.description !== undefined
        ? { description: patch.description || null }
        : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(
    `[admin] Oppdaterte kategori ${id} ("${existing.name}"): ${Object.keys(patch).join(", ")}`,
  );
  return NextResponse.json({ ok: true, category: data });
}
