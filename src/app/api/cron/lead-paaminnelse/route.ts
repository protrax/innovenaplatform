import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { serverEnv, clientEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Én påminnelse til dem som ga fra seg kontaktinfo, men ikke fullførte.
 *
 * Trakten viste hvor dyrt frafallet er: av 21 økter nådde 1 siste steg. De
 * som falt av hadde allerede sagt hva de trengte og lagt igjen e-post — de
 * manglet bare de siste minuttene. Vi lot dem gå.
 *
 * Reglene er strenge med vilje:
 *   · tidligst en time etter fangst — ikke mens de fortsatt sitter der
 *   · senest et døgn etter — er den eldre, er den kald og hører hjemme i
 *     en telefonsamtale, ikke i en automatisk e-post
 *   · kun én gang per økt (paaminnelse_sendt_at), aldri en purring nummer to
 *   · aldri til en som har publisert forespørselen i mellomtiden
 *
 * Grunnlaget er GDPR art. 6 nr. 1 b: kunden ba selv om tilbud, og dette er
 * oppfølging av den forespørselen — ikke markedsføring.
 */

const EN_TIME = 60 * 60 * 1000;
const ET_DOGN = 24 * EN_TIME;

function fortsettLenke(rad: {
  session_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  user_input: string | null;
  service: string | null;
}): string {
  const base = clientEnv.NEXT_PUBLIC_APP_URL ?? "https://platform.innovena.no";
  const qs = new URLSearchParams();
  // description utløser auto-fremrykk i veiviseren, så de lander på steg 2
  // med alt de skrev — de skal ikke skrive det samme en gang til.
  if (rad.user_input) qs.set("description", rad.user_input);
  if (rad.service) qs.set("service", rad.service);
  if (rad.full_name) qs.set("name", rad.full_name);
  qs.set("email", rad.email);
  if (rad.phone) qs.set("phone", rad.phone);
  if (rad.company) qs.set("company", rad.company);
  qs.set("sid", rad.session_id);
  qs.set("source", "paaminnelse");
  return `${base}/lag-forespoersel?${qs.toString()}`;
}

export async function GET(request: Request) {
  // Vercel signerer kojobber med denne headeren. Uten sjekken kan hvem som
  // helst utløse utsending ved å treffe adressen.
  const auth = request.headers.get("authorization");
  if (serverEnv.CRON_SECRET && auth !== `Bearer ${serverEnv.CRON_SECRET}`) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const naa = Date.now();
  const admin = createAdminClient();

  const { data: apne, error } = await admin
    .from("lead_captures")
    .select("id, session_id, email, full_name, phone, company, user_input, service")
    .is("project_id", null)
    .is("paaminnelse_sendt_at", null)
    .lt("created_at", new Date(naa - EN_TIME).toISOString())
    .gt("created_at", new Date(naa - ET_DOGN).toISOString())
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sendt = 0;
  for (const rad of apne ?? []) {
    // Await, ikke fire-and-forget: i en kojobb finnes ingen bruker som
    // venter, og et løst promise dør med instansen.
    await sendEmail({
      type: "fullfor_paaminnelse",
      to_email: rad.email,
      kunde_navn: rad.full_name ?? null,
      beskrivelse: rad.user_input ?? null,
      fortsett_lenke: fortsettLenke(rad),
    });
    await admin
      .from("lead_captures")
      .update({ paaminnelse_sendt_at: new Date().toISOString() })
      .eq("id", rad.id);
    sendt += 1;
  }

  return NextResponse.json({ ok: true, vurdert: apne?.length ?? 0, sendt });
}
