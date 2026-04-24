import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic, MODEL_FAST, MODEL_QUALITY } from "./client";
import {
  WIZARD_SYSTEM_PROMPT,
  WIZARD_SYSTEM_PROMPT_VERSION,
} from "./system-prompts";
import {
  BriefOutput,
  BudgetEstimateOutput,
  CategorizeOutput,
  ProjectPlanOutput,
  ScopeSuggestionOutput,
  UrlEnrichmentOutput,
} from "./schemas";

// Shared cached system block — frozen content means cache hits across users.
function systemBlocks() {
  return [
    {
      type: "text" as const,
      text: `[v${WIZARD_SYSTEM_PROMPT_VERSION}]\n\n${WIZARD_SYSTEM_PROMPT}`,
      cache_control: { type: "ephemeral" as const },
    },
  ];
}

export async function categorize(input: {
  userText: string;
}): Promise<CategorizeOutput> {
  const client = getAnthropic();
  const response = await client.messages.parse({
    model: MODEL_FAST,
    max_tokens: 1024,
    system: systemBlocks(),
    messages: [
      {
        role: "user",
        content: `Brukerens beskrivelse av hva de trenger:\n\n"""${input.userText}"""\n\nReturnér de 1–4 mest relevante kategori-slugs fra listen i systemprompten. Hvis brukeren beskriver flere behov, ta alle som er nevnt. Hvis ingen passer godt, returnér et tomt array.`,
      },
    ],
    output_config: { format: zodOutputFormat(CategorizeOutput) },
  });
  if (!response.parsed_output) {
    throw new Error("AI returnerte ingen strukturert respons");
  }
  return response.parsed_output;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitleAndMeta(html: string): {
  title: string;
  description: string;
} {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const descMatch =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    ) ||
    html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    );
  return {
    title: titleMatch?.[1]?.trim() ?? "",
    description: descMatch?.[1]?.trim() ?? "",
  };
}

async function fetchPageContent(url: string): Promise<{
  ok: boolean;
  title: string;
  description: string;
  text: string;
  domain: string;
}> {
  const domain = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }
  })();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; InnovenaBot/1.0; +https://innovena.no)",
        accept: "text/html,application/xhtml+xml,application/xml",
        "accept-language": "nb-NO,nb;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[enrichUrl] fetch ${url} returned ${res.status}`);
      return { ok: false, title: "", description: "", text: "", domain };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      console.warn(`[enrichUrl] ${url} not HTML (${contentType})`);
      return { ok: false, title: "", description: "", text: "", domain };
    }
    const html = await res.text();
    const { title, description } = extractTitleAndMeta(html);
    const text = stripHtml(html).slice(0, 8000);
    return { ok: true, title, description, text, domain };
  } catch (err) {
    console.error(`[enrichUrl] fetch ${url} failed:`, err);
    return { ok: false, title: "", description: "", text: "", domain };
  }
}

export async function enrichUrl(input: {
  url: string;
}): Promise<UrlEnrichmentOutput> {
  const page = await fetchPageContent(input.url);

  const prompt = page.ok
    ? `Analyser nettsiden ${input.url} og ekstraher kontekst om selskapet.

METADATA:
Tittel: ${page.title || "(ingen)"}
Meta-beskrivelse: ${page.description || "(ingen)"}

SYNLIG TEKST PÅ SIDEN (kan inneholde nav-elementer og footer — ignorer støy):
${page.text || "(ingen)"}

Basert på dette innholdet, fyll ut alle felt du kan utlede med rimelig sikkerhet. Hvis noe ikke lar seg utlede, bruk null. For company_size_signal, bruk kvalifiserte signaler (antall ansatte nevnt, type kunder/case, eventuell børsnotering, antall kontorer, etc.). Default til 'small' kun hvis du er genuint usikker.`
    : `Kunne ikke hente innhold fra ${input.url} (blokkert, nede, eller ikke HTML).

Prøv å utlede hva du kan fra domenet (${page.domain}):
- company_name: bruk domenenavnet som utgangspunkt (f.eks. "innovena.no" → "Innovena")
- industry, offering, target_audience: sett til null
- company_size_signal: bruk "small" som default

Ikke gjett vilt om detaljer du ikke har grunnlag for.`;

  const client = getAnthropic();
  const response = await client.messages.parse({
    model: MODEL_FAST,
    max_tokens: 2048,
    system: systemBlocks(),
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(UrlEnrichmentOutput) },
  });
  if (!response.parsed_output) {
    throw new Error("AI returnerte ingen strukturert respons");
  }
  return response.parsed_output;
}

export async function suggestScope(input: {
  categorySlugs: string[];
  businessContext: string;
  userGoal: string;
}): Promise<ScopeSuggestionOutput> {
  const client = getAnthropic();
  const response = await client.messages.parse({
    model: MODEL_FAST,
    max_tokens: 2048,
    system: systemBlocks(),
    messages: [
      {
        role: "user",
        content: `Foreslå leveranser for et prosjekt:

Kategorier: ${input.categorySlugs.join(", ")}

Om virksomheten:
${input.businessContext}

Kundens mål:
${input.userGoal}

Gi 6–12 konkrete leveranser som er vanlige og verdiskapende for denne typen prosjekt. Marker de viktigste som recommended=true (typisk 4–6 stk). Hold titler korte (maks 6 ord) og beskrivelser på én setning.`,
      },
    ],
    output_config: { format: zodOutputFormat(ScopeSuggestionOutput) },
  });
  if (!response.parsed_output) {
    throw new Error("AI returnerte ingen strukturert respons");
  }
  return response.parsed_output;
}

export async function estimateBudget(input: {
  categorySlugs: string[];
  selectedDeliverables: string[];
  businessContext: string;
  companySizeSignal?: "micro" | "small" | "medium" | "large" | null;
}): Promise<BudgetEstimateOutput> {
  const client = getAnthropic();
  const sizeLine = input.companySizeSignal
    ? `Bedriftsstørrelse (fra enrichment): ${input.companySizeSignal}`
    : `Bedriftsstørrelse: ikke oppgitt — bruk "small" som default med mindre konteksten tydelig antyder noe annet`;
  const response = await client.messages.parse({
    model: MODEL_FAST,
    max_tokens: 1024,
    system: systemBlocks(),
    messages: [
      {
        role: "user",
        content: `Estimer et realistisk budsjettspenn (NOK eks. mva) for et prosjekt:

Kategorier: ${input.categorySlugs.join(", ")}

${sizeLine}

Om virksomheten:
${input.businessContext}

Valgte leveranser:
${input.selectedDeliverables.map((d) => `- ${d}`).join("\n")}

Bruk prisnivået i systemprompten, kalibrert etter bedriftsstørrelsen over. Husk reglene:
- Alltid bruk bedriftsstørrelsen som primær kalibrator
- Ikke estimer 300k for en kafé bare fordi scope inkluderer "SEO"
- Ved flere leveranser: legg sammen og trekk 10-20% for synergier
- Nevn i rationale hvordan størrelsen påvirket estimatet

Estimér 2-4 faktorer som kan dra prisen oppover.`,
      },
    ],
    output_config: { format: zodOutputFormat(BudgetEstimateOutput) },
  });
  if (!response.parsed_output) {
    throw new Error("AI returnerte ingen strukturert respons");
  }
  return response.parsed_output;
}

export interface BriefInput {
  categorySlugs: string[];
  businessContext: string;
  userGoal: string;
  selectedDeliverables: string[];
  budgetMinNok: number | null;
  budgetMaxNok: number | null;
  timeline: string;
  locationPreference: string;
  extraNotes: string;
}

export async function generateBrief(input: BriefInput): Promise<BriefOutput> {
  const client = getAnthropic();
  // Fall back to deriving scope from the user's goal if no deliverables were
  // explicitly chosen (older callers, or the scope-suggestion call failed).
  const deliverables =
    input.selectedDeliverables.length > 0
      ? input.selectedDeliverables
      : [input.userGoal];
  const response = await client.messages.parse({
    model: MODEL_QUALITY,
    max_tokens: 4096,
    system: systemBlocks(),
    messages: [
      {
        role: "user",
        content: `Lag en profesjonell, lettlest prosjektbrief som byråer kan bruke til å gi presise tilbud.

Data fra wizarden:

Kategorier: ${input.categorySlugs.join(", ")}

Om virksomheten:
${input.businessContext}

Mål:
${input.userGoal}

Ønskede leveranser:
${deliverables.map((d) => `- ${d}`).join("\n")}

Budsjett: ${input.budgetMinNok ?? "?"} – ${input.budgetMaxNok ?? "?"} NOK
Tidsramme: ${input.timeline}
Lokasjon/preferanser: ${input.locationPreference}
Tilleggsnotater: ${input.extraNotes || "(ingen)"}

Lag en kort og presis markdown-brief med disse seksjonene:
## Om oss
## Mål
## Omfang
## Budsjett og tidsramme
## Krav og preferanser

Unngå fluff. Bruk kulepunkter der det gir mening. Ikke ta med "Takk for at du leser" eller liknende. Tittelen skal være konkret og unik — ikke en generisk fraseringe som "Ny nettside til virksomhet".`,
      },
    ],
    output_config: { format: zodOutputFormat(BriefOutput) },
  });
  if (!response.parsed_output) {
    throw new Error("AI returnerte ingen strukturert respons");
  }
  return response.parsed_output;
}

// ============================================================================
// Project plan — auto-generated after a bid is accepted
// ============================================================================

export interface ProjectPlanInput {
  projectTitle: string;
  projectDescription: string;
  tenantName: string;
  amountNok: number;
  deliveryWeeks: number | null;
  bidSummary: string;
  bidDescription: string;
  bidIncludes: string[];
}

export async function generateProjectPlan(
  input: ProjectPlanInput,
): Promise<ProjectPlanOutput> {
  const client = getAnthropic();
  const weeks = input.deliveryWeeks ?? 8;
  const response = await client.messages.parse({
    model: MODEL_FAST,
    max_tokens: 4096,
    system: systemBlocks(),
    messages: [
      {
        role: "user",
        content: `Lag en realistisk prosjektplan for prosjektet under. Planen skal være så ferdig at byrået kan starte i morgen, men enkel å justere.

PROSJEKT: ${input.projectTitle}
BYRÅ: ${input.tenantName}
VERDI: ${input.amountNok} NOK eks. mva
LEVERANSETID: ${weeks} uker

Kundens brief:
${input.projectDescription}

Tilbudssammendrag:
${input.bidSummary}

Detaljert tilbud:
${input.bidDescription}

Inkluderer:
${input.bidIncludes.map((i) => `- ${i}`).join("\n") || "(ikke spesifisert)"}

Regler for planen:
- Total varighet: ${weeks} uker. Fordel \`days_after_start\` jevnt — hold siste oppgave innen ${weeks * 7} dager, men legg en sluttkontroll nær enden.
- Ha med KUNDE-avhengigheter tidlig: tilganger til analytics/CMS/domene/GitHub/sosiale medier, innhold kunden må levere, godkjenning av design. Merk disse \`owner: "customer"\` og \`visibility: "shared"\`.
- Ha med byråets reelle leveranseoppgaver (design, build, SEO, testing, launch, opplæring). Merk \`owner: "tenant"\` og \`visibility: "shared"\` så kunden ser progresjonen.
- 2–4 oppgaver kan være \`visibility: "internal"\` (byråets egne QA, retro, intern kick-off) — skjules for kunden.
- Milepæler: 3–6 stk som beskriver hovedfasene kronologisk (f.eks. "Kick-off", "Design godkjent", "Beta på stage", "Launch").
- IKKE generiske oppgaver som "start prosjektet" — hver oppgave skal være konkret nok til å avgjøre når den er ferdig.
- Språk: norsk bokmål, handlingsorientert tone.`,
      },
    ],
    output_config: { format: zodOutputFormat(ProjectPlanOutput) },
  });
  if (!response.parsed_output) {
    throw new Error("AI returnerte ingen strukturert respons");
  }
  return response.parsed_output;
}
