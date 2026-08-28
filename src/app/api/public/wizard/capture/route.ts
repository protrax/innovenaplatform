import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail } from "@/lib/email/send";
import { serverEnv } from "@/lib/env";

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
        company: tekst(body.company, 200),
        // «hero» = fanget i skjemaet pa innovena.no, for videresending.
        // «veiviser» = fanget i steg 2 her. Skillet forteller hvilken av de
        // to fangstpunktene som faktisk virker.
        fanget_paa: tekst(body.fangetPaa, 20) ?? 'veiviser',
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

    /*
      Varsle med en gang.

      Fangsten fungerte, men ingen fikk vite om den: raden la i /admin/trakt
      til noen tilfeldigvis apnet sida. Forste ekte fangst ble oppdaget tre
      dager for sent. Et lead som skal ringes, er ferskvare.

      Sendes en gang per okt (varsel_sendt_at), og aldri for en som allerede
      har publisert forespoerselen — de far den vanlige prosjektvarslingen.

      Hentes som et eget kall, ikke som .select() pa upserten over. Kolonnene
      varsel_sendt_at og paaminnelse_sendt_at kommer av en migrasjon: kjores
      koden for migrasjonen, skal fangsten fortsatt lagres — det er den som
      er verdifull. Da feiler bare dette oppslaget, og varselet uteblir.
    */
    const { data: rad } = await admin
      .from("lead_captures")
      .select("id, project_id, varsel_sendt_at, full_name, phone, company, user_input, source, highest_step")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (rad && !rad.project_id && !rad.varsel_sendt_at && serverEnv.ADMIN_EMAIL) {
      queueEmail({
        type: "lead_fanget",
        to_email: serverEnv.ADMIN_EMAIL,
        kunde_navn: rad.full_name ?? null,
        kunde_epost: email,
        kunde_telefon: rad.phone ?? null,
        selskap: rad.company ?? null,
        beskrivelse: rad.user_input ?? null,
        kilde: rad.source ?? null,
        steg: rad.highest_step ?? 2,
      });
      await admin
        .from("lead_captures")
        .update({ varsel_sendt_at: new Date().toISOString() })
        .eq("id", rad.id);
    }

    return NextResponse.json({ ok: true }, { headers: cors() });
  } catch {
    // Fangst skal aldri velte veiviseren.
    return NextResponse.json({ ok: true }, { headers: cors() });
  }
}
