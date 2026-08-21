import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

/**
 * Logger at en okt naadde et steg i veiviseren.
 *
 * Bakgrunn: plattformen hadde ingen maling overhodet. Vi sa bare de som kom
 * helt gjennom — tre prosjekter — og hadde ingen mate a vite hvor de andre
 * falt av. Uten det er enhver diskusjon om konvertering gjetning.
 *
 * Ingen personopplysninger: en tilfeldig okt-id fra nettleseren, steget,
 * og hvor de kom fra. Skrives med service-rollen slik at ingen kan fylle
 * tabellen fra nettleseren, og unik indeks paa (session_id, step) gjor at
 * samme steg bare telles en gang per okt.
 *
 * Kallet er bevisst «best effort»: feiler det, skal det aldri stoppe
 * brukeren i a fullfore forespoerselen.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: true }, { headers: cors() });

    const sessionId = String(body.sessionId ?? "").slice(0, 64);
    const step = Number(body.step);

    if (!sessionId || !Number.isInteger(step) || step < 1 || step > 6) {
      return NextResponse.json({ ok: true }, { headers: cors() });
    }

    const admin = createAdminClient();
    // Konflikt betyr at steget allerede er talt for denne okten. Det er
    // forventet — brukeren kan ga fram og tilbake — og skal ikke feile.
    await admin.from("wizard_events").upsert(
      {
        session_id: sessionId,
        step,
        source: body.source ? String(body.source).slice(0, 80) : null,
        service: body.service ? String(body.service).slice(0, 80) : null,
      },
      { onConflict: "session_id,step", ignoreDuplicates: true },
    );

    return NextResponse.json({ ok: true }, { headers: cors() });
  } catch {
    // Maling skal aldri velte forespoerselen.
    return NextResponse.json({ ok: true }, { headers: cors() });
  }
}
