import { z } from "zod";

// Structured output schemas for each wizard operation.
// Keep these tight — Claude's structured outputs require additionalProperties: false
// and don't support numeric/string constraints (those are stripped by the SDK).

export const CategorizeOutput = z.object({
  category_slugs: z
    .array(z.string())
    .describe("1–4 matchende kategori-slugs fra listen"),
  rationale: z
    .string()
    .describe("Én kort setning om hvorfor disse kategoriene ble valgt"),
});
export type CategorizeOutput = z.infer<typeof CategorizeOutput>;

export const UrlEnrichmentOutput = z.object({
  company_name: z.string().nullable(),
  industry: z.string().nullable().describe("Bransje, f.eks. 'Restaurant', 'SaaS', 'B2B-konsulent'"),
  offering: z.string().nullable().describe("Hva selskapet tilbyr, 1–2 setninger"),
  target_audience: z.string().nullable().describe("Typisk kunde/målgruppe"),
  tone: z.string().nullable().describe("Merkevare-tonalitet, f.eks. 'profesjonell og varm'"),
  current_stack_signals: z
    .array(z.string())
    .describe("Tekniske signaler fra nettsiden (CMS, e-handel, CRM osv.) — tom array hvis ingen"),
  notes: z.string().nullable().describe("Andre observasjoner som vil hjelpe et byrå"),
  location: z
    .string()
    .nullable()
    .describe("By/region der selskapet holder til, om synlig"),
  company_size_signal: z
    .enum(["micro", "small", "medium", "large"])
    .describe(
      "Estimert selskapsstørrelse ut fra nettsidens innhold: micro=enkeltperson/familiebedrift, small=1-10 ansatte (kafé, håndverker, solo-konsulent), medium=10-100 ansatte (typisk SMB), large=100+ eller enterprise-klienter. Bruk 'small' som default hvis usikker.",
    ),
  company_size_rationale: z
    .string()
    .nullable()
    .describe("Én setning som forklarer størrelsesvurderingen"),
});
export type UrlEnrichmentOutput = z.infer<typeof UrlEnrichmentOutput>;

export const ScopeSuggestionOutput = z.object({
  deliverables: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        recommended: z.boolean().describe("Om dette bør være default avhuket"),
      }),
    )
    .describe("6–12 konkrete leveranser som passer kategori + kontekst"),
});
export type ScopeSuggestionOutput = z.infer<typeof ScopeSuggestionOutput>;

export const BudgetEstimateOutput = z.object({
  min_nok: z
    .number()
    .describe("Realistisk laveste budsjett i NOK eks. mva — skal være realistisk for oppgitt bedriftsstørrelse"),
  max_nok: z
    .number()
    .describe("Realistisk høyeste budsjett i NOK eks. mva"),
  rationale: z
    .string()
    .describe("2–3 setninger. Nevn kort hvordan bedriftsstørrelse påvirket estimatet."),
  factors_that_raise: z
    .array(z.string())
    .describe("Faktorer som kan dra prisen oppover"),
});
export type BudgetEstimateOutput = z.infer<typeof BudgetEstimateOutput>;

export const BriefOutput = z.object({
  title: z.string().describe("Kort prosjekttittel, maks 80 tegn"),
  brief_markdown: z
    .string()
    .describe(
      "Ferdig brief i markdown, strukturert med seksjoner: Om oss, Mål, Omfang, Budsjett/tid, Krav og preferanser",
    ),
});
export type BriefOutput = z.infer<typeof BriefOutput>;

export const ProjectPlanOutput = z.object({
  milestones: z
    .array(z.string())
    .describe(
      "3–6 overordnede milepæler som beskriver prosjektets hovedfaser, i kronologisk rekkefølge",
    ),
  tasks: z
    .array(
      z.object({
        title: z.string().describe("Kort, handlingsrettet tittel på oppgaven"),
        description: z
          .string()
          .describe("1–3 setninger som forklarer hva som skal gjøres og hvorfor"),
        owner: z
          .enum(["tenant", "customer"])
          .describe(
            "tenant = byrået gjør oppgaven. customer = kunden gjør oppgaven (f.eks. tilganger, innhold, godkjenning).",
          ),
        visibility: z
          .enum(["shared", "internal"])
          .describe(
            "shared = begge parter ser oppgaven. internal = kun byråets eget team (f.eks. intern QA, retro).",
          ),
        days_after_start: z
          .number()
          .int()
          .describe(
            "Hvor mange dager etter prosjektstart oppgaven har frist. 0 = dag én.",
          ),
      }),
    )
    .describe(
      "Realistisk prosjektplan med 8–25 oppgaver. Dekk både byråets leveranser og kundeavhengigheter (tilganger, innhold, godkjenninger). Fordel fristene jevnt over leveranseperioden.",
    ),
});
export type ProjectPlanOutput = z.infer<typeof ProjectPlanOutput>;
