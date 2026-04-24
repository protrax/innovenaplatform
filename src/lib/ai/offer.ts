import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getAnthropic, MODEL_QUALITY } from "./client";
import { WIZARD_SYSTEM_PROMPT_VERSION } from "./system-prompts";

// Separate system prompt for the offer-text generator. Kept frozen for caching.
const OFFER_SYSTEM_PROMPT = `Du er Innovena sin AI-assistent som hjelper norske byråer og konsulenter å skrive kundevennlige, profesjonelle tilbud.

Du skriver ALLTID norsk (bokmål), klart og konsist. Målet er at kunden — som ofte ikke er tekniker — skjønner hva de får, hvorfor det er verdifullt, og hvordan prosessen blir.

Gode tilbud:
- Starter med hva kunden får (leveransen) og hvilken verdi det gir
- Bruker enkelt språk, ikke fagsjargong
- Er strukturert: sammendrag → leveranser → prosess → neste steg
- Er ærlige om hva som er og ikke er inkludert
- Unngår floskler som "skreddersydd løsning" eller "vi skaper magi"
- Holder seg til fakta, ikke salgsfraser

Unngå å love noe byrået ikke har bekreftet (f.eks. konkrete tidsrammer, spesifikk teknologi) hvis det ikke er oppgitt i byråets input. Parafrasér heller enn å finne på.`;

export const OfferTextOutput = z.object({
  summary: z
    .string()
    .describe("1–2 setninger som fanger kjernen av tilbudet"),
  description_markdown: z
    .string()
    .describe(
      "Full tilbudstekst i markdown: introduksjon, leveranser, prosess, neste steg",
    ),
  includes: z
    .array(z.string())
    .describe("Kort liste (5–10 punkter) med det som er inkludert"),
});
export type OfferTextOutput = z.infer<typeof OfferTextOutput>;

export interface GenerateOfferInput {
  projectTitle: string;
  projectDescription: string;
  customerBudgetMin: number | null;
  customerBudgetMax: number | null;
  agencyInput: {
    amount: number;
    deliveryWeeks: number | null;
    keyPoints: string;
  };
  tenantName: string;
}

export async function generateOfferText(
  input: GenerateOfferInput,
): Promise<OfferTextOutput> {
  const client = getAnthropic();
  const budgetLine =
    input.customerBudgetMin && input.customerBudgetMax
      ? `${input.customerBudgetMin.toLocaleString("nb-NO")} – ${input.customerBudgetMax.toLocaleString("nb-NO")} NOK`
      : "ikke oppgitt";

  const response = await client.messages.parse({
    model: MODEL_QUALITY,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: `[v${WIZARD_SYSTEM_PROMPT_VERSION}]\n\n${OFFER_SYSTEM_PROMPT}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Lag et profesjonelt, kundevennlig tilbud basert på følgende:

KUNDENS FORESPØRSEL
Tittel: ${input.projectTitle}
Budsjett kunden oppga: ${budgetLine}
Beskrivelse:
${input.projectDescription}

BYRÅETS TILBUD (råmateriale fra byrået, uredigert)
Byrå: ${input.tenantName}
Pris: ${input.agencyInput.amount.toLocaleString("nb-NO")} NOK
${input.agencyInput.deliveryWeeks ? `Leveringstid: ${input.agencyInput.deliveryWeeks} uker` : "Leveringstid: ikke oppgitt"}
Nøkkelpunkter / notater fra byrået:
${input.agencyInput.keyPoints}

Skriv tilbudet slik at kunden raskt forstår:
1) hva de får (leveransen)
2) hvorfor det er verdifullt i deres kontekst
3) hvordan prosessen ser ut (typisk 3–5 steg)
4) neste steg hvis de aksepterer

Totalt bør tilbudsteksten være 200–500 ord. Ikke ta med pris eller leveringstid i description_markdown — de vises separat i grensesnittet. Ikke signer med "Med vennlig hilsen" eller liknende — presentasjonen håndteres av plattformen.`,
      },
    ],
    output_config: { format: zodOutputFormat(OfferTextOutput) },
  });

  if (!response.parsed_output) {
    throw new Error("AI returnerte ingen strukturert respons");
  }
  return response.parsed_output;
}

interface GenerateOfferInputVars {
  amount: number;
  deliveryWeeks: number | null;
  keyPoints: string;
}
export type { GenerateOfferInputVars };
