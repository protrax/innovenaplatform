// Contract body template — composed from project + accepted bid.
// Kept in code (not AI-generated) so the legal content is deterministic.

export interface ContractTemplateInput {
  projectTitle: string;
  projectDescription: string;
  tenantName: string;
  tenantOrgNumber: string | null;
  customerName: string;
  customerEmail: string;
  amountNok: number;
  deliveryWeeks: number | null;
  bidSummary: string;
  bidDescription: string;
  bidIncludes: string[];
}

export function buildContractBody(input: ContractTemplateInput): {
  title: string;
  summary: string;
  body_markdown: string;
  terms_markdown: string;
} {
  const title = input.projectTitle;
  const summary = input.bidSummary;

  const deliveryLine = input.deliveryWeeks
    ? `${input.deliveryWeeks} uker fra avtalestart`
    : "Avtales mellom partene ved oppstart";

  const includesBlock =
    input.bidIncludes.length > 0
      ? input.bidIncludes.map((i) => `- ${i}`).join("\n")
      : "- Spesifiseres i detalj ved oppstart";

  const body_markdown = `## Parter

**Oppdragsgiver (kunde)**
${input.customerName}
${input.customerEmail}

**Leverandør**
${input.tenantName}${input.tenantOrgNumber ? ` (org.nr. ${input.tenantOrgNumber})` : ""}

## Prosjekt

${input.projectDescription}

## Leveranse

${input.bidDescription}

### Inkludert i leveransen

${includesBlock}

## Økonomi

**Pris:** ${input.amountNok.toLocaleString("nb-NO")} NOK eks. mva

Fakturering skjer via Innovena-plattformen. Betalingsbetingelser avtales per faktura (typisk netto 14 dager).

## Tidsramme

${deliveryLine}
`;

  const terms_markdown = `## Generelle vilkår

1. **Bindende avtale**. Avtalen er rettslig bindende for begge parter når begge har akseptert den elektronisk via Innovena-plattformen. Elektronisk aksept sidestilles med underskrift i henhold til Lov om elektroniske tillitstjenester.

2. **Endringer**. Endringer i omfang eller leveranse skal dokumenteres skriftlig (f.eks. via meldingsfunksjonen i plattformen) og kan medføre justering av pris og tidsramme.

3. **Immaterielle rettigheter**. Ved full betaling overdras rettigheter til leveransen til kunden, med unntak av leverandørens generiske verktøy, rammeverk og interne bibliotek som forblir leverandørens eiendom.

4. **Konfidensialitet**. Begge parter skal behandle informasjon utvekslet i forbindelse med avtalen som konfidensiell, og ikke dele den med tredjepart uten samtykke.

5. **Ansvar**. Leverandørens samlede ansvar er begrenset til avtalt pris. Ingen av partene er ansvarlige for indirekte tap.

6. **Innovena som plattform**. Innovena er tilrettelegger av avtalen og er ikke part i den underliggende leveransen. Innovena kan ta et servicegebyr på betalinger som håndteres via plattformen, dette vises transparent ved betaling.

7. **Tvister**. Ved tvist skal partene først forsøke å finne en løsning gjennom dialog. Tvister som ikke lar seg løse behandles etter norsk rett med Oslo tingrett som rett verneting.
`;

  return { title, summary, body_markdown, terms_markdown };
}
