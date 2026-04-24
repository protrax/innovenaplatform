import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getCurrentUser, defaultRouteForUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock,
  FileSignature,
  Inbox,
  KanbanSquare,
  Megaphone,
  Plug,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:
    "Innovena — Kvalifiserte leads rett i pipelinen din. CRM gratis for alltid.",
  description:
    "Vi driver innovena.no og matcher kvalifiserte leads mot norske byrå. Pipeline, AI-tilbud, prosjektstyring og timer — gratis for alltid. Lead-abonnement fra 2 990 kr/mnd.",
  keywords: [
    "leads for byrå Norge",
    "kvalifiserte leads",
    "gratis CRM",
    "AI tilbudsskriver",
    "prosjektstyring byrå",
    "innovena.no",
  ],
  openGraph: {
    title: "Innovena — Leads rett i pipelinen",
    description:
      "Vi driver innovena.no. Du får leadsene. CRM og AI-tilbud gratis.",
    type: "website",
    locale: "nb_NO",
  },
};

// Palette
// Dark:  bg #14100e  surface #1b1613  surface2 #25201c  text #f6f1ea
// Light: bg #fbf7f0  surface #f3ede1  ink #14100e  muted #64594f
// Accent coral: base #ff7849 / bright #ffb094 / deep #c84a1f / tint-bg #2a1613

const TIERS = [
  {
    name: "Gratis",
    kicker: "Forever free",
    price: "0 kr",
    period: "",
    desc: "For byrå og konsulenter som vil ha proff arbeidsflate uten å forplikte seg.",
    features: [
      "Full CRM & pipeline",
      "AI-tilbudsskriver",
      "Prosjektstyring med AI-plan",
      "Timekontroll + rapporter",
      "Kontrakt & e-signering",
      "Profil i marketplace",
      "Webhook for egne leads",
    ],
    notIncluded: [
      "Automatiske matchende leads fra innovena.no",
    ],
    cta: "Opprett gratis konto",
    href: "/registrer?rolle=byraa",
  },
  {
    name: "Pro Leads",
    kicker: "Mest populær",
    price: "2 990 kr",
    period: "/mnd",
    desc: "For byrå og solo-konsulenter som vil ha kvalifiserte leads levert automatisk.",
    features: [
      "Alt i Gratis, pluss:",
      "Garantert 3–5 leads/mnd",
      "Prioritert matching",
      "Featured i 2 kategorier",
      "Varsling i sanntid",
      "4 % platformgebyr på vunne deals",
    ],
    notIncluded: [],
    cta: "Kom i gang",
    href: "/registrer?rolle=byraa",
    featured: true,
  },
  {
    name: "Elite",
    kicker: "For de som skalerer",
    price: "6 990 kr",
    period: "/mnd",
    desc: "Top-prioritet i matching. Vinn mer ved å svare raskest.",
    features: [
      "Alt i Pro, pluss:",
      "Garantert 10–15 leads/mnd",
      "Top-prioritet — alltid blant de 3–5 matchede byråene",
      "2 timer tidlig tilgang før øvrige byrå",
      "2,5 % platformgebyr på vunne deals",
      "Dedikert Customer Success",
    ],
    notIncluded: [],
    cta: "Kom i gang",
    href: "/registrer?rolle=byraa",
  },
];

const FAQ_ITEMS = [
  {
    q: "Er CRM-et virkelig gratis?",
    a: "Ja. Pipeline, AI-tilbudsskriver, prosjektstyring, timekontroll og kontrakter er gratis for alltid — for både solo-konsulenter og team. Ingen kortinformasjon, ingen skjulte gebyrer. Gratis-planen gir ikke automatiske matchende leads fra innovena.no — det er Pro- og Elite-planen.",
  },
  {
    q: "Hvor kommer leadsene fra?",
    a: "Fra innovena.no — vårt forbrukerrettede lead-gen-nettsted. Norske bedrifter fyller ut en AI-assistert brief. Vi validerer, matcher mot dine kategorier, lokasjon og kapasitet, og sender leadet rett i pipelinen din som et nytt kort. Kun 3–5 byrå ser samme lead, så du unngår spam-konkurransen.",
  },
  {
    q: "Hva betyr 'garantert 3–5 leads/mnd'?",
    a: "I Pro-planen lover vi minst 3 kvalifiserte leads per måned i dine valgte kategorier. Hvis vi ikke leverer, refunderer vi abonnementet. Lead-kvalitet går alltid foran kvantitet — vi filtrerer hardt.",
  },
  {
    q: "Hvordan kvalifiserer dere leadsene?",
    a: "Kunder går gjennom en 5-stegs AI-wizard. Budsjett, omfang, tidslinje og bransje valideres. Vi har verifisert e-post, telefonnummer og nettside før leadet går ut. Under 8 % avvises som uegnede.",
  },
  {
    q: "Hva får jeg ekstra med Elite?",
    a: "Top-prioritet i matching — du er alltid blant de 3–5 byråene som får se leadet (gitt at kategori, lokasjon og kapasitet stemmer). Du ser også leadet 2 timer før øvrige byrå, så du rekker å forberede et skarpere tilbud. Begrenset antall Elite-plasser per kategori — første mann til mølla.",
  },
  {
    q: "Er dette relevant for solo-konsulenter, ikke bare byrå?",
    a: "Ja. Solo-konsulenter lister seg selv på innovena.no (som frilans-konsulent) — kunder og byrå kan booke dere til enkeltprosjekter eller løpende engasjementer. Samme prisstruktur: gratis CRM + lead-abonnement for å motta automatiske leads.",
  },
  {
    q: "Hva er platformgebyret på?",
    a: "Kun på deals som stammer fra leads vi har levert til deg via innovena.no. 4 % på Pro, 2,5 % på Elite. Faktureres når kunden har betalt. Ingen gebyr på egne leads (via webhook eller direkte kontakt).",
  },
  {
    q: "Er dataene våre trygge?",
    a: "Alle data ligger i EU (Frankfurt), kryptert ved transport og lagring. GDPR-kompatibel. Databehandleravtale tilgjengelig ved forespørsel.",
  },
];

export default async function PlatformLanding() {
  const user = await getCurrentUser();
  if (user) redirect(defaultRouteForUser(user));

  return (
    <div className="relative min-h-screen bg-[#fbf7f0] text-[#14100e] selection:bg-[#ff7849] selection:text-white">
      <div className="relative z-10">
        {/* =======================================================
            NAV (sits above hero — transparent top)
        ======================================================== */}
        <header className="sticky top-0 z-40 border-b border-[#14100e]/5 bg-[#fbf7f0]/85 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#14100e]"
            >
              <Logo />
              Innovena
            </Link>
            <nav className="hidden items-center gap-8 text-sm text-[#14100e]/70 md:flex">
              <Link href="#plattform" className="hover:text-[#14100e]">
                Plattform
              </Link>
              <Link href="#for-deg" className="hover:text-[#14100e]">
                Byrå / Konsulent
              </Link>
              <Link href="#pris" className="hover:text-[#14100e]">
                Pris
              </Link>
              <Link href="#faq" className="hover:text-[#14100e]">
                FAQ
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <Link
                href="/logg-inn"
                className="hidden text-sm text-[#14100e]/70 hover:text-[#14100e] md:inline-flex md:px-3 md:py-2"
              >
                Logg inn
              </Link>
              <Link
                href="/registrer?rolle=byraa"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#14100e] px-4 py-2 text-sm font-semibold text-[#fbf7f0] transition-opacity hover:opacity-90"
              >
                Opprett gratis <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </header>

        {/* =======================================================
            HERO — light, continuous with nav, product screenshot centered
        ======================================================== */}
        <section className="relative overflow-hidden px-6 pb-24 pt-20 sm:pt-24">
          {/* Warm ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[1100px] -translate-x-1/2 rounded-full bg-[#ff7849]/15 blur-[160px]"
          />
          {/* Faint grid pattern */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.4]"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(20,16,14,0.08) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage:
                "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)",
            }}
          />

          <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#ff7849]/30 bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c84a1f] backdrop-blur-sm">
              <Target className="h-3 w-3" /> For norske byrå og konsulenter
            </div>
            <h1 className="text-balance max-w-4xl text-5xl font-bold leading-[1.02] tracking-tight text-[#14100e] sm:text-6xl md:text-[5.25rem]">
              Leads rett i pipelinen.{" "}
              <span className="block text-[#c84a1f]">CRM gratis.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-[#64594f] md:text-xl">
              Pipeline, AI-tilbudsskriver, prosjektstyring og timer —{" "}
              <span className="text-[#14100e]">gratis for alltid</span>.
              Oppgrader for å få{" "}
              <span className="text-[#14100e]">
                kvalifiserte leads levert automatisk
              </span>
              .
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/registrer?rolle=byraa"
                className="inline-flex h-12 items-center gap-2 rounded-md bg-[#14100e] px-7 text-base font-semibold text-white shadow-lg shadow-[#14100e]/20 transition-transform hover:-translate-y-px"
              >
                Opprett gratis konto <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#plattform"
                className="inline-flex h-12 items-center gap-2 rounded-md border border-[#14100e]/15 bg-white px-7 text-base font-medium text-[#14100e] transition-colors hover:bg-[#14100e] hover:text-white"
              >
                Se plattformen
              </Link>
            </div>
            <p className="mt-4 text-xs text-[#64594f]">
              Ingen kort · Gratis for alltid · Lead-abonnement fra 2 990 kr/mnd
            </p>
          </div>

          {/* Hero product shot — framed like a real browser window */}
          <div className="relative mx-auto mt-16 w-full max-w-6xl">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[3rem] bg-[#ff7849]/10 blur-[80px]"
            />
            <div className="relative overflow-hidden rounded-xl bg-[#14100e] ring-1 ring-[#14100e]/10 shadow-[0_40px_80px_rgba(20,16,14,0.25)]">
              <div className="flex items-center gap-2 border-b border-white/5 bg-[#100c0a] px-5 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <span className="ml-4 flex items-center gap-2 rounded bg-white/5 px-3 py-1 text-[11px] text-white/40">
                  <ShieldCheck className="h-3 w-3" /> platform.innovena.no
                </span>
              </div>
              <Image
                src="/product-shots/pipeline.png"
                alt="Innovena pipeline — Kanban-tavle med kvalifiserte leads"
                width={1800}
                height={1200}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        {/* =======================================================
            LEAD FLOW EXPLAINER — light section, magazine layout
        ======================================================== */}
        <section id="hvorfor" className="px-6 py-28 md:py-32">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-16 max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c84a1f]">
                Lead-flyten
              </div>
              <h2 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-[#14100e] md:text-5xl">
                Du trenger ikke drive markedsføring.{" "}
                <span className="text-[#c84a1f]">Det gjør vi.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-lg text-[#64594f]">
                Vi investerer i SEO, innhold og kampanjer som bringer norske
                bedrifter til innovena.no. Du bruker tiden på å vinne dealer —
                ikke jakte dem.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <FlowCard
                n="01"
                icon={Users}
                title="Kunden finner innovena.no"
                body="Norske bedrifter fyller ut en AI-assistert brief med prosjekt, omfang og budsjett."
              />
              <FlowArrow />
              <FlowCard
                n="02"
                icon={Target}
                title="Vi matcher dere"
                body="AI validerer og matcher mot dine kategorier, lokasjon og kapasitet. Under 8 % avvises."
                highlight
              />
              <FlowArrow />
              <FlowCard
                n="03"
                icon={Inbox}
                title="Leadet havner i pipen"
                body="Nytt kort i pipelinen, varsel på e-post. Send tilbud direkte fra Innovena."
              />
            </div>

            <div className="mt-10 rounded-lg border border-[#ff7849]/30 bg-[#fff4ed] p-6 text-sm text-[#64594f]">
              <strong className="text-[#14100e]">
                Kun 3–5 byrå per lead.
              </strong>{" "}
              Ingen spam-konkurranse som på Mittanbud. Vi holder listen kort —
              kundene får skarpe tilbud, dere får høy win-rate.
            </div>
          </div>
        </section>

        {/* =======================================================
            PRODUCT SECTION 1 — PIPELINE (cream bg, dark on light)
        ======================================================== */}
        <section
          id="plattform"
          className="border-y border-[#14100e]/5 bg-[#f3ede1] px-6 py-28 md:py-32"
        >
          <div className="mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-7 lg:pr-8">
              <CapLabel>Pipeline</CapLabel>
              <h2 className="text-4xl font-bold leading-[1.08] tracking-tight text-[#14100e] md:text-5xl">
                Pipeline som faktisk holder seg oppdatert
              </h2>
              <p className="text-lg text-[#64594f]">
                Dra-og-slipp mellom stadier. Se hvem som eier hvert lead, hva
                det er verdt, og hva som må skje videre.
              </p>
              <ul className="space-y-3 text-[#14100e]">
                {[
                  "Innovena-leads og egne leads i samme pipeline",
                  "Tildel til teammedlem med aktivitetslogg",
                  "Tilpass stadier og farger for ditt byrå",
                  "Kontakter, meldinger og filer samlet per lead",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#c84a1f]" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <ProductFrame
              src="/product-shots/pipeline.png"
              alt="Pipeline — Kanban-tavle med kort fordelt på stadier"
            />
          </div>
        </section>

        {/* =======================================================
            PRODUCT SECTION 2 — AI BID WRITER (dark band)
        ======================================================== */}
        <section className="bg-[#14100e] px-6 py-28 text-[#f6f1ea] md:py-32">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1.4fr_1fr]">
            <ProductFrame
              src="/product-shots/ai-bid-writer.png"
              alt="AI-tilbudsskriver — split-view mellom brief og formatert tilbud"
              dark
            />
            <div className="space-y-7 lg:pl-8">
              <CapLabel tone="dark">AI-tilbud</CapLabel>
              <h2 className="text-4xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl">
                AI skriver tilbudet. Du justerer tonen.
              </h2>
              <p className="text-lg text-white/70">
                Én knapp. AI leser kundens brief, foreslår scope og pris, og
                leverer et ferdig formatert tilbud på 2 minutter.
              </p>
              <ul className="space-y-3 text-white/85">
                {[
                  "Leser briefen og henter kontekst fra kundens nettside",
                  "Lærer av dine tidligere vunnede tilbud",
                  "Justér tonen — profesjonell, direkte eller varm",
                  "Send til e-signering direkte fra editoren",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#ff9975]" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* =======================================================
            PRODUCT SECTION 3 — PROJECT WORKSPACE (cream)
        ======================================================== */}
        <section className="bg-[#fbf7f0] px-6 py-28 md:py-32">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-7 lg:pr-8">
              <CapLabel>Prosjekter</CapLabel>
              <h2 className="text-4xl font-bold leading-[1.08] tracking-tight text-[#14100e] md:text-5xl">
                Prosjektplanen skriver seg selv
              </h2>
              <p className="text-lg text-[#64594f]">
                Når kunden aksepterer tilbudet lager AI hele planen — oppgaver,
                milepæler og kundeavhengigheter basert på det vunne tilbudet.
              </p>
              <ul className="space-y-3 text-[#14100e]">
                {[
                  "Realistiske frister spredd over leveranseperioden",
                  "Kundens oppgaver (tilganger, innhold) holdes separate",
                  "Interne oppgaver skjules for kunden",
                  "Kunden følger fremdriften i egen portal",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#c84a1f]" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <ProductFrame
              src="/product-shots/project-workspace.png"
              alt="Prosjektstyring — oppgaver, milepæler og team-panel"
            />
          </div>
        </section>

        {/* =======================================================
            PRODUCT SECTION 4 — TIME TRACKING (dark band)
        ======================================================== */}
        <section className="bg-[#14100e] px-6 py-28 text-[#f6f1ea] md:py-32">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1.4fr_1fr]">
            <ProductFrame
              src="/product-shots/time-tracking.png"
              alt="Timekontroll med ukesoversikt og løpende timer"
              dark
            />
            <div className="space-y-7 lg:pl-8">
              <CapLabel tone="dark">Timekontroll</CapLabel>
              <h2 className="text-4xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl">
                Timer som blir til penger
              </h2>
              <p className="text-lg text-white/70">
                Start en timer med ett klikk. Tiden logges mot oppgaven og
                prosjektet — og havner automatisk på neste faktura.
              </p>
              <ul className="space-y-3 text-white/85">
                {[
                  "Fakturerbare timer markeres automatisk",
                  "Ukesoversikt per kunde og konsulent",
                  "Løpende timer flyttes mellom oppgaver",
                  "Eksport til Fiken, Tripletex og CSV",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#ff9975]" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* =======================================================
            CAPABILITIES GRID (light)
        ======================================================== */}
        <section className="bg-[#fbf7f0] px-6 py-28">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-14 max-w-2xl">
              <CapLabel>I plattformen</CapLabel>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#14100e] md:text-5xl">
                Åtte verktøy. Inkludert i gratis-planen.
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {[
                { icon: Inbox, title: "Lead-innboks", body: "Matchende leads i din innboks." },
                { icon: KanbanSquare, title: "Pipeline", body: "Dra-og-slipp CRM + aktivitetslogg." },
                { icon: Sparkles, title: "AI-tilbud", body: "Vinnende tilbud på 2 minutter." },
                { icon: Target, title: "Prosjektstyring", body: "AI-lagt plan fra tilbudet." },
                { icon: Clock, title: "Timekontroll", body: "Logges mot oppgaver automatisk." },
                { icon: FileSignature, title: "Kontrakt", body: "E-signert, Stripe-faktura." },
                { icon: Plug, title: "Webhook", body: "Egen nettside og Zapier inn i CRM." },
                { icon: Megaphone, title: "Profil", body: "Offentlig profil på innovena.no." },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-lg bg-white p-6 ring-1 ring-[#14100e]/5 transition-all hover:ring-[#ff7849]/30"
                >
                  <f.icon className="mb-4 h-5 w-5 text-[#c84a1f]" strokeWidth={1.5} />
                  <h4 className="text-sm font-semibold text-[#14100e]">
                    {f.title}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-[#64594f]">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =======================================================
            FOR BYRÅ vs FOR KONSULENTER — two audiences
        ======================================================== */}
        <section
          id="for-deg"
          className="bg-[#14100e] px-6 py-28 text-[#f6f1ea] md:py-32"
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-16 max-w-3xl">
              <CapLabel tone="dark">Hvem er Innovena for?</CapLabel>
              <h2 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl">
                Byrå, konsulenthus og frilansere.
              </h2>
              <p className="mt-5 max-w-2xl text-lg text-white/70">
                Vi lister dere begge på innovena.no — og sender leads rett i
                pipelinen. Samme plattform, to ulike salgskanaler.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Byråer */}
              <div className="flex flex-col rounded-xl bg-[#1b1613] p-10 ring-1 ring-white/5">
                <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-md bg-[#ff7849]/15 text-[#ff9975]">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-white">
                  For byrå og konsulenthus
                </h3>
                <p className="mt-3 text-sm text-white/70">
                  Komplett operativsystem for byrået. List konsulentene dine i
                  marketplace, motta leads matchet mot deres spesialfelt,
                  fordel prosjekter i teamet.
                </p>
                <ul className="mt-6 space-y-2.5 text-sm text-white/85">
                  {[
                    "Ubegrenset antall team-medlemmer",
                    "Individuelle konsulent-profiler i marketplace",
                    "CRM delt på tvers av teamet",
                    "Pipeline-tildeling og intern aktivitetslogg",
                    "Timeføring per konsulent og prosjekt",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9975]" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/registrer?rolle=byraa"
                  className="mt-10 inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Opprett byrå-konto <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Konsulenter */}
              <div className="flex flex-col rounded-xl bg-[#1b1613] p-10 ring-1 ring-white/5">
                <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-md bg-[#ff7849]/15 text-[#ff9975]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-white">
                  For solo-konsulenter
                </h3>
                <p className="mt-3 text-sm text-white/70">
                  List deg selv som frilans-konsulent. Kunder og byrå kan booke
                  deg på enkeltprosjekter eller løpende engasjementer.
                </p>
                <ul className="mt-6 space-y-2.5 text-sm text-white/85">
                  {[
                    "Egen profil på innovena.no med portefølje",
                    "Timepris-bookbar for direkte engasjementer",
                    "Lead-abonnement for matchede forespørsler",
                    "CRM for dine egne kunder og kontakter",
                    "Fakturering og timekontroll innebygd",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9975]" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/registrer?rolle=solo"
                  className="mt-10 inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Opprett konsulent-profil{" "}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-white/50">
              Samme pris, samme verktøy. Velg det som passer for deg.
            </p>
          </div>
        </section>

        {/* =======================================================
            PRICING
        ======================================================== */}
        <section id="pris" className="bg-[#f3ede1] px-6 py-28 md:py-32">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-16 text-center">
              <CapLabel>Pris</CapLabel>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#14100e] md:text-5xl">
                Gratis arbeidsflate.{" "}
                <span className="text-[#c84a1f]">Betal for leads.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-[#64594f]">
                Vi tjener når du tjener. Bruk CRM-et fritt — oppgrader når du
                vil ha leads fra innovena.no levert automatisk.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {TIERS.map((t) => (
                <PricingCard key={t.name} {...t} />
              ))}
            </div>

            {/* Marketing upsell */}
            <div className="mt-6 flex flex-col items-start justify-between gap-6 rounded-lg bg-white p-8 ring-1 ring-[#14100e]/5 md:flex-row md:items-center">
              <div className="flex items-start gap-5">
                <div className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#ff7849]/15 text-[#c84a1f]">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-[#14100e]">
                    Markedsføringspakker for vekst
                  </h4>
                  <p className="mt-1 text-sm text-[#64594f]">
                    Fremhevet plassering, kategorispesifikk eksponering og
                    PR-kampanjer. Fra 4 990 kr/mnd — lanseres når lead-supply
                    skaleres.
                  </p>
                </div>
              </div>
              <a
                href="mailto:salg@innovena.no"
                className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[#14100e]/15 bg-transparent px-5 py-3 text-sm font-medium text-[#14100e] transition-colors hover:bg-[#14100e] hover:text-white"
              >
                Snakk med salg <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>

            {/* Value anchor */}
            <div className="mt-10 rounded-lg border border-[#14100e]/10 bg-white p-6 text-sm text-[#64594f]">
              <strong className="text-[#14100e]">Sammenlikn:</strong> 10
              kvalifiserte B2B-leads via Google Ads eller kald outbound koster
              typisk 15–25 000 kr/mnd i annonsebudsjett — uten
              AI-match-algoritme, uten CRM, uten prosjektstyring. Du får alt
              dette på Elite for 6 990 kr/mnd.
            </div>

            <div className="mt-8 grid gap-4 text-center text-xs text-[#64594f] md:grid-cols-3">
              <div>Alle priser eks. mva.</div>
              <div>Ingen bindingstid — pauses når du vil</div>
              <div>Data lagret i EU · GDPR-kompatibel</div>
            </div>
          </div>
        </section>

        {/* =======================================================
            FOUNDER QUOTE
        ======================================================== */}
        <section className="bg-[#14100e] px-6 py-28 text-[#f6f1ea]">
          <div className="mx-auto w-full max-w-4xl">
            <div className="rounded-xl bg-[#1b1613] p-10 ring-1 ring-[#ff7849]/15 md:p-14">
              <div className="mb-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ff9975]">
                Fra grunnleggeren
              </div>
              <blockquote className="text-xl leading-relaxed text-white md:text-2xl">
                <span className="text-[#ff9975]">&ldquo;</span>
                Som byrå ville jeg ha leads uten å drive markedsføring hele
                tiden — og CRM-verktøyene vi faktisk bruker hver dag. Så bygde
                jeg plattformen jeg selv trengte. CRM-et er gratis fordi det er
                riktig — vi tjener når dere vinner deals, ikke før.
                <span className="text-[#ff9975]">&rdquo;</span>
              </blockquote>
              <div className="mt-8 flex items-center gap-3 border-t border-white/10 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#ff7849]/15 text-sm font-semibold text-[#ff9975]">
                  JF
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    Joakim Flatmoen
                  </div>
                  <div className="text-xs text-white/50">
                    Grunnlegger, Innovena
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =======================================================
            FAQ
        ======================================================== */}
        <section id="faq" className="bg-[#fbf7f0] px-6 py-28 md:py-32">
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-14 text-center">
              <CapLabel>Spørsmål</CapLabel>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#14100e] md:text-5xl">
                Det de fleste lurer på
              </h2>
            </div>
            <div className="space-y-3">
              {FAQ_ITEMS.map((item, i) => (
                <details
                  key={i}
                  className="group rounded-lg bg-white ring-1 ring-[#14100e]/5 [&_summary::-webkit-details-marker]:hidden"
                  {...(i === 0 ? { open: true } : {})}
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left">
                    <h4 className="text-base font-semibold text-[#14100e] md:text-lg">
                      {item.q}
                    </h4>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#64594f] transition-transform group-open:rotate-180 group-open:text-[#c84a1f]" />
                  </summary>
                  <p className="border-t border-[#14100e]/5 px-6 py-5 text-sm leading-relaxed text-[#64594f]">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* =======================================================
            FINAL CTA
        ======================================================== */}
        <section className="bg-[#fbf7f0] px-6 pb-28">
          <div
            className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-[#14100e] p-14 text-center text-[#f6f1ea] md:p-20"
            style={{ boxShadow: "0 40px 80px rgba(20, 16, 14, 0.2)" }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-[#ff7849]/25 blur-3xl"
            />
            <div className="relative space-y-6">
              <h2 className="text-balance text-4xl font-bold tracking-tight text-white md:text-5xl">
                Første lead venter i pipelinen din.
              </h2>
              <p className="mx-auto max-w-xl text-lg text-white/70">
                Opprett en gratis konto i dag. Aktiver lead-abonnement når du
                er klar.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/registrer?rolle=byraa"
                  className="inline-flex h-12 items-center gap-2 rounded-md bg-[#ff7849] px-8 text-base font-semibold text-white shadow-xl shadow-[#ff7849]/25 transition-transform hover:-translate-y-px"
                >
                  Opprett gratis konto <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="mailto:salg@innovena.no"
                  className="inline-flex h-12 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-8 text-base font-medium text-white transition-colors hover:bg-white/10"
                >
                  Book 15-min demo
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* =======================================================
            FOOTER
        ======================================================== */}
        <footer className="border-t border-[#14100e]/5 bg-[#f3ede1] px-6 py-16">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-14 grid grid-cols-2 gap-10 md:grid-cols-5">
              <div className="col-span-2">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-base font-semibold text-[#14100e]"
                >
                  <Logo />
                  Innovena
                </Link>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#64594f]">
                  Kvalifiserte leads for moderne norske byrå. Vi driver
                  innovena.no og leverer rett i pipelinen.
                </p>
              </div>
              <FooterCol
                title="Plattform"
                links={[
                  { label: "Hvorfor", href: "#hvorfor" },
                  { label: "Plattform", href: "#plattform" },
                  { label: "Pris", href: "#pris" },
                  { label: "FAQ", href: "#faq" },
                ]}
              />
              <FooterCol
                title="Selskap"
                links={[
                  { label: "innovena.no", href: "https://innovena.no" },
                  { label: "Kontakt", href: "mailto:hei@innovena.no" },
                  { label: "Salg", href: "mailto:salg@innovena.no" },
                ]}
              />
              <FooterCol
                title="Juridisk"
                links={[
                  { label: "Personvern", href: "/personvern" },
                  { label: "Vilkår", href: "/vilkaar" },
                  { label: "Databehandler", href: "/databehandler" },
                ]}
              />
            </div>
            <div className="flex flex-col items-center justify-between gap-3 border-t border-[#14100e]/10 pt-8 text-sm text-[#64594f] md:flex-row">
              <p>© {new Date().getFullYear()} Innovena Platform AS</p>
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck className="h-3 w-3" />
                <span>Data lagret i EU · GDPR-kompatibel</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// =================================================
// Helpers
// =================================================

function Logo() {
  return (
    <span
      className="inline-block h-5 w-5 rounded-md bg-gradient-to-br from-[#ff7849] to-[#c84a1f]"
      aria-hidden
    />
  );
}

function CapLabel({
  children,
  tone = "light",
}: {
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${
        tone === "dark" ? "text-[#ff9975]" : "text-[#c84a1f]"
      }`}
    >
      {children}
    </div>
  );
}

function FlowCard({
  n,
  icon: Icon,
  title,
  body,
  highlight,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-7 ${
        highlight
          ? "bg-gradient-to-br from-[#fff4ed] to-white ring-1 ring-[#ff7849]/30 shadow-lg shadow-[#ff7849]/10"
          : "bg-white ring-1 ring-[#14100e]/5"
      }`}
    >
      <div className="mb-5 flex items-center justify-between">
        <div
          className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${
            highlight
              ? "bg-[#ff7849] text-white"
              : "bg-[#ff7849]/15 text-[#c84a1f]"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64594f]/50">
          {n}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-[#14100e]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#64594f]">{body}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center">
      <ArrowRight
        className="h-5 w-5 rotate-90 text-[#ff7849] md:rotate-0"
        strokeWidth={1.5}
      />
    </div>
  );
}

function ProductFrame({
  src,
  alt,
  dark,
}: {
  src: string;
  alt: string;
  dark?: boolean;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className={`pointer-events-none absolute -inset-6 -z-10 rounded-3xl blur-3xl ${
          dark ? "bg-[#ff7849]/15" : "bg-[#ff7849]/10"
        }`}
      />
      <div
        className={`overflow-hidden rounded-xl ${
          dark ? "ring-1 ring-white/10" : "ring-1 ring-[#14100e]/10"
        } shadow-[0_30px_70px_rgba(0,0,0,0.35)]`}
      >
        <Image
          src={src}
          alt={alt}
          width={1800}
          height={1200}
          className="h-auto w-full"
        />
      </div>
    </div>
  );
}

function PricingCard(t: {
  name: string;
  kicker: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  notIncluded: string[];
  cta: string;
  href: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-xl p-8 ${
        t.featured
          ? "bg-[#14100e] text-white ring-2 ring-[#ff7849] shadow-xl shadow-[#ff7849]/20"
          : "bg-white ring-1 ring-[#14100e]/10"
      }`}
    >
      {t.featured ? (
        <div className="absolute -top-3 left-8 rounded-md bg-[#ff7849] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          {t.kicker}
        </div>
      ) : null}
      <div
        className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] ${
          t.featured ? "text-[#ff9975]" : "text-[#c84a1f]"
        }`}
      >
        {t.name}
      </div>
      <div className="mb-2 flex items-baseline gap-1">
        <span
          className={`text-4xl font-bold ${
            t.featured ? "text-white" : "text-[#14100e]"
          }`}
        >
          {t.price}
        </span>
        <span
          className={`text-sm ${
            t.featured ? "text-white/60" : "text-[#64594f]"
          }`}
        >
          {t.period}
        </span>
      </div>
      <p
        className={`mb-7 text-sm ${
          t.featured ? "text-white/70" : "text-[#64594f]"
        }`}
      >
        {t.desc}
      </p>
      <ul className="mb-8 space-y-2.5 text-sm">
        {t.features.map((f, i) => (
          <li
            key={f}
            className={`flex items-start gap-2 ${
              t.featured ? "text-white/90" : "text-[#14100e]"
            } ${i === 0 && f.startsWith("Alt i") ? "italic opacity-70" : ""}`}
          >
            <Check
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                t.featured ? "text-[#ff9975]" : "text-[#c84a1f]"
              }`}
            />
            <span>{f}</span>
          </li>
        ))}
        {t.notIncluded.map((f) => (
          <li
            key={f}
            className={`flex items-start gap-2 text-sm ${
              t.featured ? "text-white/40" : "text-[#64594f]"
            }`}
          >
            <span className="mt-1 block h-0.5 w-3 shrink-0 bg-current" />
            <span className="line-through">{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={t.href}
        className={`mt-auto inline-flex h-11 items-center justify-center gap-1.5 rounded-md text-sm font-semibold transition-transform hover:-translate-y-px ${
          t.featured
            ? "bg-[#ff7849] text-white shadow-lg shadow-[#ff7849]/30"
            : "border border-[#14100e]/15 bg-transparent text-[#14100e] hover:bg-[#14100e] hover:text-white"
        }`}
      >
        {t.cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
      {t.name === "Gratis" ? (
        <p className="mt-3 text-center text-xs text-[#64594f]">
          Ingen kort · Gratis forever
        </p>
      ) : null}
      {t.name === "Pro Leads" ? (
        <p className="mt-3 text-center text-xs text-white/50">
          3–5 leads/mnd garantert · refund hvis ikke
        </p>
      ) : null}
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64594f]/60">
        {title}
      </h4>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-sm text-[#64594f] transition-colors hover:text-[#14100e]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
