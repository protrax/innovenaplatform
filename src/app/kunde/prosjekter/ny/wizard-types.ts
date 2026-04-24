export interface WizardCategory {
  id: string;
  name: string;
  slug: string;
}

export interface Deliverable {
  title: string;
  description: string;
  recommended: boolean;
}

export interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  // step 1
  userInput: string;
  url: string;
  enrichedFromUrl: string | null; // which URL we enriched from (for "Auto-fylt fra X" label)
  // derived from AI
  selectedCategorySlugs: string[];
  enrichment: {
    company_name: string | null;
    industry: string | null;
    offering: string | null;
    target_audience: string | null;
    tone: string | null;
    current_stack_signals: string[];
    notes: string | null;
    location: string | null;
    company_size_signal: "micro" | "small" | "medium" | "large";
    company_size_rationale: string | null;
  } | null;
  // step 2 — structured context fields (each individually editable)
  ctxCompanyName: string;
  ctxIndustry: string;
  ctxOffering: string;
  ctxTargetAudience: string;
  ctxLocation: string;
  ctxNotes: string;
  // step 3
  userGoal: string;
  suggestedDeliverables: Deliverable[];
  selectedDeliverables: string[]; // titles
  extraDeliverable: string;
  // step 4
  budgetMinNok: number;
  budgetMaxNok: number;
  budgetRationale: string;
  timeline: string;
  locationPreference: string;
  extraNotes: string;
  // step 5
  briefTitle: string;
  briefMarkdown: string;
}

// Assemble the structured fields into a single context blob for AI downstream
// calls (scope suggestion, budget estimation, brief generation).
export function buildBusinessContext(s: WizardState): string {
  return [
    s.ctxCompanyName && `Selskap: ${s.ctxCompanyName}`,
    s.ctxIndustry && `Bransje: ${s.ctxIndustry}`,
    s.ctxOffering && `Tilbyr: ${s.ctxOffering}`,
    s.ctxTargetAudience && `Målgruppe: ${s.ctxTargetAudience}`,
    s.ctxLocation && `Lokasjon: ${s.ctxLocation}`,
    s.ctxNotes && `Notater: ${s.ctxNotes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const WIZARD_STORAGE_KEY = "innovena-wizard-v1";

export function defaultState(): WizardState {
  return {
    step: 1,
    userInput: "",
    url: "",
    enrichedFromUrl: null,
    selectedCategorySlugs: [],
    enrichment: null,
    ctxCompanyName: "",
    ctxIndustry: "",
    ctxOffering: "",
    ctxTargetAudience: "",
    ctxLocation: "",
    ctxNotes: "",
    userGoal: "",
    suggestedDeliverables: [],
    selectedDeliverables: [],
    extraDeliverable: "",
    budgetMinNok: 50000,
    budgetMaxNok: 150000,
    budgetRationale: "",
    timeline: "1-3 måneder",
    locationPreference: "Norge eller fjernarbeid OK",
    extraNotes: "",
    briefTitle: "",
    briefMarkdown: "",
  };
}

export const TIMELINE_OPTIONS = [
  "Så raskt som mulig",
  "Innen 1 måned",
  "1–3 måneder",
  "Fleksibelt",
];

export const LOCATION_OPTIONS = [
  "Norge eller fjernarbeid OK",
  "Kun fjernarbeid",
  "Må være basert i Norge",
  "Må kunne møtes fysisk (spesifiser by i notat)",
];
