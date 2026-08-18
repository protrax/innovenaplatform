import Link from "next/link";
import { SignUpForm } from "./sign-up-form";
import { createAdminClient } from "@/lib/supabase/admin";

type RoleChoice = "byraa" | "solo";

type Search = Promise<{ rolle?: string }>;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const params = await searchParams;
  const raw = params.rolle;
  const rolle: RoleChoice = raw === "solo" ? "solo" : "byraa";

  // Hentes med admin-klienten fordi brukeren ikke er innlogget ennå.
  const admin = createAdminClient();
  const { data: categories } = await admin
    .from("service_categories")
    .select("id, name")
    .eq("active", true)
    .order("sort_order");

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1a]">
        Opprett kontoen din
      </h1>
      <p className="mt-2 text-sm text-[#6b6d68]">
        Gratis for alltid. Ingen kortinfo, ingen bindingstid.
      </p>

      {/*
        Et byrå påpekte offentlig at prisen ikke sto noe sted før man hadde
        registrert seg. Den hører hjemme her, før du bruker tid på skjemaet —
        og det viktigste er at gratisnivået faktisk mottar forespørsler.
      */}
      <div className="mt-6 border border-[#e5e5e0] bg-[#f4f4f0] p-4 text-sm">
        <p className="font-semibold text-[#1a1c1a]">
          Du mottar forespørsler gratis
        </p>
        <p className="mt-1 text-[#3f423e]">
          Hver forespørsel går til inntil fem byråer i riktig fagområde.
          Abonnement kjøper deg køplass når flere matcher den samme — det er
          ikke adgangen.
        </p>
        <ul className="mt-3 space-y-1 text-[#3f423e]">
          <li>
            <span className="font-medium text-[#1a1c1a]">Gratis — 0 kr.</span>{" "}
            Profil, pipeline, tilbud og prosjektstyring. Tar inntil to av de
            fem plassene, og alle fem når ingen abonnent matcher.
          </li>
          <li>
            <span className="font-medium text-[#1a1c1a]">
              Pro Leads — 2 990 kr/mnd.
            </span>{" "}
            Prioritet foran gratisnivået, varsling i sanntid.
          </li>
          <li>
            <span className="font-medium text-[#1a1c1a]">
              Elite — 6 990 kr/mnd.
            </span>{" "}
            Topprioritet i deres kategorier, dedikert oppfølging.
          </li>
        </ul>
        <p className="mt-3 text-xs text-[#6b6d68]">
          I tillegg 2,5 % plattformgebyr på betalinger som går gjennom
          plattformen. Det er hele prislisten. Ingen bindingstid — du kan falle
          tilbake til gratis og beholde profil, verktøy og historikk.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <SignUpForm initialRole={rolle} categories={categories ?? []} />
        <p className="text-center text-sm text-[#6b6d68]">
          Har du konto?{" "}
          <Link
            href="/logg-inn"
            className="font-semibold text-[#576500] underline-offset-4 hover:underline"
          >
            Logg inn
          </Link>
        </p>
        <p className="rounded-md border border-[#1a1c1a]/10 bg-[#f4f4f0] p-3 text-center text-sm text-[#6b6d68]">
          Skal du <strong className="text-[#1a1c1a]">ha et prosjekt gjort</strong>?
          Du trenger ikke opprette konto —{" "}
          <Link
            href="/lag-forespoersel"
            className="font-semibold text-[#576500] underline-offset-4 hover:underline"
          >
            beskriv prosjektet her
          </Link>{" "}
          så får du tilbud fra kvalitetssikrede byråer.
        </p>
      </div>
    </div>
  );
}
