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

const EPOST = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Lagrer et lead sa snart vi har navn og e-post — for kunden fullforer.
 *
 * Det gamle skjemaet pa innovena.no spurte om kontaktinfo forst og lagret
 * leadet umiddelbart. Det ga 25 leads i maneden pa det meste. Veiviseren
 * spurte forst i steg 5, og alt som falt av underveis ble borte.
 *
 * Kallet er «best effort» pa samme mate som trakt-sporingen: feiler det, skal
 * kunden fortsatt komme videre i veiviseren. Et tapt lead er ille, men en
 * veiviser som stopper opp er verre.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: true }, { headers: cors() });

    const sessionId = String(body.sessionId ?? "").slice(0, 64);
    const email = String(body.email ?? "").trim().slice(0, 200);

    // Uten okt-id kan vi ikke oppdatere raden senere, og uten e-post er
    // leadet verdilost. Begge deler stoppes stille.
    if (!sessionId || !EPOST.test(email)) {
      return NextResponse.json({ ok: true }, { headers: cors() });
    }

    const tekst = (v: unknown, n: number) =>
      v ? String(v).trim().slice(0, n) || null : null;

    const admin = createAdminClient();
    await admin.from("lead_captures").upsert(
      {
        session_id: sessionId,
        email,
        full_name: tekst(body.fullName, 200),
        phone: tekst(body.phone, 40),
        user_input: tekst(body.userInput, 4000),
        source: tekst(body.source, 80),
        service: tekst(body.service, 80),
        category_slugs: Array.isArray(body.categorySlugs)
          ? body.categorySlugs.slice(0, 12).map((s: unknown) => String(s).slice(0, 80))
          : [],
        highest_step: Number.isInteger(body.step) ? body.step : 2,
        // Settes nar forespoerselen faktisk ble publisert. Da er raden bare
        // historikk, og skal ikke dukke opp blant dem som ma folges opp.
        project_id: tekst(body.projectId, 40),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
    );

    return NextResponse.json({ ok: true }, { headers: cors() });
  } catch {
    // Fangst skal aldri velte veiviseren.
    return NextResponse.json({ ok: true }, { headers: cors() });
  }
}
