"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RangeSlider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, formatCurrencyNOK } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { RotatingLoader } from "@/components/ui/rotating-loader";
import {
  buildBusinessContext,
  defaultState,
  LOCATION_OPTIONS,
  TIMELINE_OPTIONS,
  type Deliverable,
  type WizardCategory,
  type WizardState,
} from "../kunde/prosjekter/ny/wizard-types";

const CRAWL_MESSAGES = [
  "Analyserer beskrivelsen din…",
  "Leser forsiden på nettstedet…",
  "Identifiserer bransje og målgruppe…",
  "Leser tonalitet og merkevare…",
  "Vurderer bedriftsstørrelse…",
  "Henter tekniske signaler…",
  "Setter sammen konteksten…",
];

// LocalStorage key distinct from authed wizard so they don't collide
const PUBLIC_STORAGE_KEY = "innovena-public-wizard-v1";
const TOTAL_STEPS = 5;

/**
 * Startpunkter som viser bredden i hva vi tar imot. De tre siste finnes fordi
 * folk som skal leie inn konsulenter — eller byråer som mangler kapasitet på
 * en sluttkundeleveranse — ellers antar at dette bare er for prosjekter.
 */
const NEED_EXAMPLES: { label: string; text: string }[] = [
  {
    label: "Et helt prosjekt",
    text: "Vi trenger en ny nettside med nettbutikk. Dagens løsning er utdatert og fungerer dårlig på mobil. Vi selger til privatkunder i Norge og har rundt 200 produkter.",
  },
  {
    label: "Én konsulent",
    text: "Vi trenger en senior frontend-utvikler i cirka 3 måneder, 3 dager i uken, til å jobbe sammen med vårt eget team. React og TypeScript. Oppstart så snart som mulig.",
  },
  {
    label: "Flere konsulenter",
    text: "Vi skal bemanne et prosjektteam i 6 måneder: én backend-utvikler, én frontend-utvikler og en UX-designer på deltid. Helst folk som kan jobbe hos oss noen dager i uken.",
  },
  {
    label: "Ekstra kapasitet",
    text: "Vi er et byrå som har tatt på oss mer enn vi rekker. Vi trenger noen som kan sette opp én AI-agent for en av våre sluttkunder — vi står for kundedialogen, dere leverer teknisk.",
  },
];

interface PublicWizardState extends WizardState {
  customer_email: string;
  customer_full_name: string;
  customer_phone: string;
}

function publicDefault(): PublicWizardState {
  return {
    ...defaultState(),
    customer_email: "",
    customer_full_name: "",
    customer_phone: "",
  };
}

export function PublicWizard({
  categories,
  aiEnabled,
}: {
  categories: WizardCategory[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<PublicWizardState>(publicDefault);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  /**
   * Trakt-sporing. Plattformen hadde ingen maling: vi sa bare de som kom helt
   * gjennom, og visste ikke hvor de andre falt av.
   *
   * Okt-id-en er tilfeldig og lever i sessionStorage — den folger ikke
   * personen mellom besok og er ikke koblet til noe identifiserende.
   */
  const sessionIdRef = useRef<string>("");
  const sporetRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      let id = sessionStorage.getItem("innovena-wizard-session");
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem("innovena-wizard-session", id);
      }
      sessionIdRef.current = id;
    } catch {
      /* privat modus e.l. — da maler vi ikke, og det er greit */
    }
  }, []);

  useEffect(() => {
    if (!hydrated || !sessionIdRef.current) return;
    if (sporetRef.current.has(state.step)) return;
    sporetRef.current.add(state.step);
    // Bevisst uten await: maling skal aldri forsinke eller velte flyten.
    void fetch("/api/public/wizard/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionIdRef.current,
        step: state.step,
        source: searchParams.get("source"),
        service: searchParams.get("service"),
      }),
      keepalive: true,
    }).catch(() => {});
  }, [state.step, hydrated]);
  // Tracks whether we've already auto-advanced based on inbound query params
  // so we don't loop or fight the user if they hit Back from step 2.
  const inboundHandledRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PUBLIC_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setState(JSON.parse(saved));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // ─── Inbound traffic from innovena.no ──────────────────────────────────
  // The marketing site posts users into the wizard with prefilled context:
  //   ?url=…&description=…&service=…&source=…
  // We hydrate state.userInput / state.url, optionally pre-select a category
  // from `service`, and skip step 1 (with AI categorize + URL enrich) when
  // there's enough info to make step 2 useful immediately.
  useEffect(() => {
    if (!hydrated || inboundHandledRef.current) return;
    const qDescription = searchParams.get("description")?.trim() ?? "";
    const qUrl = searchParams.get("url")?.trim() ?? "";
    const qService = searchParams.get("service")?.trim() ?? "";

    if (!qDescription && !qUrl && !qService) return;
    inboundHandledRef.current = true;

    // Only hydrate fields the user hasn't already filled (respect anything
    // already in localStorage from a prior visit).
    setState((prev) => ({
      ...prev,
      userInput: prev.userInput || qDescription,
      url: prev.url || qUrl,
      selectedCategorySlugs:
        prev.selectedCategorySlugs.length > 0
          ? prev.selectedCategorySlugs
          : qService && categories.some((c) => c.slug === qService)
            ? [qService]
            : prev.selectedCategorySlugs,
    }));

    // Auto-advance: if we have any combination of description/url, run the
    // step-1 AI work and land the user on step 2.
    if (qDescription || qUrl) {
      // Defer one tick so the setState above has flushed before submitStep1
      // reads it.
      setTimeout(() => {
        const updatedInput = qDescription || state.userInput;
        if (!updatedInput.trim()) return;
        // Mirror submitStep1 but read directly from query params to avoid the
        // setState race.
        if (!aiEnabled) {
          setState((prev) => ({ ...prev, step: 2 }));
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        runAiStep("Analyserer det du har sendt inn…", async () => {
          const tasks: Array<Promise<unknown>> = [
            postJson<{ category_slugs: string[] }>(
              "/api/public/wizard/categorize",
              { text: qDescription || updatedInput },
            ).then((cat) => {
              setState((prev) => ({
                ...prev,
                selectedCategorySlugs:
                  prev.selectedCategorySlugs.length > 0
                    ? prev.selectedCategorySlugs
                    : cat.category_slugs,
              }));
            }),
          ];
          if (qUrl) {
            setLoadingMessage("Leser nettsiden din…");
            tasks.push(
              postJson<NonNullable<WizardState["enrichment"]>>(
                "/api/public/wizard/enrich-url",
                { url: qUrl },
              ).then((enrichment) => {
                const notesLines = [
                  enrichment.tone && `Tonalitet: ${enrichment.tone}`,
                  enrichment.current_stack_signals.length > 0 &&
                    `Teknisk: ${enrichment.current_stack_signals.join(", ")}`,
                  enrichment.notes,
                ].filter(Boolean);
                setState((prev) => ({
                  ...prev,
                  enrichment,
                  enrichedFromUrl: qUrl,
                  ctxCompanyName:
                    prev.ctxCompanyName || enrichment.company_name || "",
                  ctxIndustry: prev.ctxIndustry || enrichment.industry || "",
                  ctxOffering: prev.ctxOffering || enrichment.offering || "",
                  ctxTargetAudience:
                    prev.ctxTargetAudience || enrichment.target_audience || "",
                  ctxLocation: prev.ctxLocation || enrichment.location || "",
                  ctxNotes: prev.ctxNotes || notesLines.join("\n"),
                }));
              }),
            );
          }
          await Promise.allSettled(tasks);
          setState((prev) => ({ ...prev, step: 2 }));
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }, 0);
    }
    // We deliberately depend on hydrated only — search params shouldn't
    // re-trigger this once we've handled them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(PUBLIC_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, hydrated]);

  function update<K extends keyof PublicWizardState>(
    key: K,
    value: PublicWizardState[K],
  ) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function goto(step: WizardState["step"]) {
    update("step", step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Ukjent feil");
    return data as T;
  }

  function runAiStep(message: string, fn: () => Promise<void>) {
    setLoading(true);
    setLoadingMessage(message);
    setError(null);
    fn()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Ukjent feil"),
      )
      .finally(() => {
        setLoading(false);
        setLoadingMessage("");
      });
  }

  function submitStep1() {
    if (!state.userInput.trim()) {
      setError("Skriv kort hva du trenger hjelp med");
      return;
    }
    if (!aiEnabled) {
      goto(2);
      return;
    }
    runAiStep("Analyserer beskrivelsen din…", async () => {
      const tasks: Array<Promise<unknown>> = [
        postJson<{
          category_slugs: string[];
        }>("/api/public/wizard/categorize", { text: state.userInput }).then(
          (cat) => {
            setState((prev) => ({
              ...prev,
              selectedCategorySlugs: cat.category_slugs,
            }));
          },
        ),
      ];
      if (state.url.trim()) {
        setLoadingMessage("Leser nettsiden din…");
        tasks.push(
          postJson<NonNullable<WizardState["enrichment"]>>(
            "/api/public/wizard/enrich-url",
            { url: state.url },
          ).then((enrichment) => {
            const notesLines = [
              enrichment.tone && `Tonalitet: ${enrichment.tone}`,
              enrichment.current_stack_signals.length > 0 &&
                `Teknisk: ${enrichment.current_stack_signals.join(", ")}`,
              enrichment.notes,
            ].filter(Boolean);
            setState((prev) => ({
              ...prev,
              enrichment,
              enrichedFromUrl: state.url,
              ctxCompanyName:
                prev.ctxCompanyName || enrichment.company_name || "",
              ctxIndustry: prev.ctxIndustry || enrichment.industry || "",
              ctxOffering: prev.ctxOffering || enrichment.offering || "",
              ctxTargetAudience:
                prev.ctxTargetAudience || enrichment.target_audience || "",
              ctxLocation: prev.ctxLocation || enrichment.location || "",
              ctxNotes: prev.ctxNotes || notesLines.join("\n"),
            }));
          }),
        );
      }
      await Promise.allSettled(tasks);
      goto(2);
    });
  }

  function submitStep3Goal() {
    if (!state.userGoal.trim()) {
      setError("Beskriv målet med prosjektet");
      return;
    }
    if (!aiEnabled) return;
    runAiStep("Foreslår leveranser…", async () => {
      const result = await postJson<{ deliverables: Deliverable[] }>(
        "/api/public/wizard/suggest-scope",
        {
          categorySlugs: state.selectedCategorySlugs,
          businessContext: buildBusinessContext(state) || state.userInput,
          userGoal: state.userGoal,
        },
      );
      setState((prev) => ({
        ...prev,
        suggestedDeliverables: result.deliverables,
        selectedDeliverables: result.deliverables
          .filter((d) => d.recommended)
          .map((d) => d.title),
      }));
    });
  }

  function enterStep4() {
    if (!state.userGoal.trim()) {
      setError("Beskriv målet før du går videre");
      return;
    }
    const deliverables = [...state.selectedDeliverables];
    if (state.extraDeliverable.trim()) deliverables.push(state.extraDeliverable);
    if (deliverables.length === 0) {
      deliverables.push(state.userGoal);
    }
    if (!aiEnabled) {
      goto(4);
      return;
    }
    runAiStep("Estimerer budsjett…", async () => {
      const result = await postJson<{
        min_nok: number;
        max_nok: number;
        rationale: string;
      }>("/api/public/wizard/estimate-budget", {
        categorySlugs: state.selectedCategorySlugs,
        selectedDeliverables: deliverables,
        businessContext: buildBusinessContext(state) || state.userInput,
        companySizeSignal: state.enrichment?.company_size_signal ?? null,
      });
      setState((prev) => ({
        ...prev,
        budgetMinNok: Math.max(5000, Math.round(result.min_nok / 1000) * 1000),
        budgetMaxNok: Math.max(10000, Math.round(result.max_nok / 1000) * 1000),
        budgetRationale: result.rationale,
      }));
      goto(4);
    });
  }

  function generateBrief() {
    if (!aiEnabled) {
      setState((prev) => ({
        ...prev,
        briefTitle: prev.userInput.split("\n")[0].slice(0, 60) || "Ny forespørsel",
        briefMarkdown: [
          "## Om oss",
          buildBusinessContext(prev) || prev.userInput,
          "",
          "## Mål",
          prev.userGoal,
          "",
          "## Omfang",
          ...prev.selectedDeliverables.map((d) => `- ${d}`),
          prev.extraDeliverable ? `- ${prev.extraDeliverable}` : "",
          "",
          "## Budsjett og tidsramme",
          `Budsjett: ${formatCurrencyNOK(prev.budgetMinNok)}–${formatCurrencyNOK(prev.budgetMaxNok)}`,
          `Tidsramme: ${prev.timeline}`,
          "",
          "## Krav og preferanser",
          prev.locationPreference,
          prev.extraNotes,
        ].join("\n"),
      }));
      goto(5);
      return;
    }
    runAiStep("Lager briefen din…", async () => {
      const deliverables = [...state.selectedDeliverables];
      if (state.extraDeliverable.trim())
        deliverables.push(state.extraDeliverable);
      const result = await postJson<{
        title: string;
        brief_markdown: string;
      }>("/api/public/wizard/generate-brief", {
        categorySlugs: state.selectedCategorySlugs,
        businessContext: buildBusinessContext(state) || state.userInput,
        userGoal: state.userGoal,
        selectedDeliverables: deliverables,
        budgetMinNok: state.budgetMinNok,
        budgetMaxNok: state.budgetMaxNok,
        timeline: state.timeline,
        locationPreference: state.locationPreference,
        extraNotes: state.extraNotes,
      });
      setState((prev) => ({
        ...prev,
        briefTitle: result.title,
        briefMarkdown: result.brief_markdown,
      }));
      goto(5);
    });
  }

  async function publish() {
    if (
      !state.customer_email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.customer_email)
    ) {
      setError("Skriv inn en gyldig e-post");
      return;
    }
    if (!state.customer_full_name.trim()) {
      setError("Skriv inn navnet ditt");
      return;
    }
    if (!state.briefTitle.trim() || !state.briefMarkdown.trim()) {
      setError("Brief mangler tittel eller innhold");
      return;
    }
    setLoading(true);
    setLoadingMessage("Sender forespørselen…");
    setError(null);
    try {
      await postJson<{ ok: true; project_id: string }>(
        "/api/public/inquiries",
        {
          customer: {
            email: state.customer_email,
            full_name: state.customer_full_name,
            phone: state.customer_phone || undefined,
          },
          project: {
            title: state.briefTitle,
            description: state.briefMarkdown,
            budget_min_nok: state.budgetMinNok,
            budget_max_nok: state.budgetMaxNok,
            category_slugs: state.selectedCategorySlugs,
          },
          source: "platform_public_wizard",
        },
      );

      try {
        localStorage.removeItem(PUBLIC_STORAGE_KEY);
      } catch {
        // ignore
      }
      router.push(
        `/lag-forespoersel/suksess?email=${encodeURIComponent(state.customer_email)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
      setLoading(false);
      setLoadingMessage("");
    }
  }

  const progressPercent = (state.step / TOTAL_STEPS) * 100;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Steg {state.step} av {TOTAL_STEPS}
          </span>
          {aiEnabled ? (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI-hjelp aktivert
            </span>
          ) : null}
        </div>
        <Progress value={progressPercent} />
      </div>

      {error ? (
        <div className="flex items-start justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Lukk">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {state.step === 1 ? (
        <Step1
          state={state}
          update={update}
          onSubmit={submitStep1}
          loading={loading}
        />
      ) : null}
      {state.step === 2 ? (
        <Step2
          state={state}
          update={update}
          categories={categories}
          onBack={() => goto(1)}
          onNext={() => goto(3)}
        />
      ) : null}
      {state.step === 3 ? (
        <Step3
          state={state}
          update={update}
          aiEnabled={aiEnabled}
          onBack={() => goto(2)}
          onGenerateScope={submitStep3Goal}
          onNext={enterStep4}
          loading={loading}
          loadingMessage={loadingMessage}
        />
      ) : null}
      {state.step === 4 ? (
        <Step4
          state={state}
          update={update}
          onBack={() => goto(3)}
          onNext={generateBrief}
          loading={loading}
          loadingMessage={loadingMessage}
        />
      ) : null}
      {state.step === 5 ? (
        <Step5
          state={state}
          update={update}
          onBack={() => goto(4)}
          onPublish={publish}
          loading={loading}
          loadingMessage={loadingMessage}
        />
      ) : null}
    </div>
  );
}

// ============================================================================
// Steps 1–4 are identical to the authed wizard (copied for independence)
// ============================================================================

function Step1({
  state,
  update,
  onSubmit,
  loading,
}: {
  state: PublicWizardState;
  update: <K extends keyof PublicWizardState>(
    key: K,
    value: PublicWizardState[K],
  ) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hva trenger du hjelp med?</CardTitle>
        <CardDescription>
          Skriv fritt — noen setninger holder. Et helt prosjekt, én eller flere
          konsulenter, eller ekstra kapasitet til noe du allerede har på gang.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Textarea
            autoFocus
            rows={5}
            placeholder="F.eks. Jeg driver en kaffebar i Bergen og trenger en ny nettside som fungerer på mobil og der folk kan bestille bordreservasjon."
            value={state.userInput}
            onChange={(e) => update("userInput", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Ikke overtenk — du kan redigere alt senere.
          </p>
        </div>

        {/* Eksemplene viser at vi tar imot mer enn prosjekter. Uten dem tror
            den som skal leie inn konsulenter, eller byrået som mangler
            kapasitet, at de er på feil sted. */}
        {!state.userInput ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Eller start fra et eksempel:
            </p>
            <div className="flex flex-wrap gap-2">
              {NEED_EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => update("userInput", ex.text)}
                  className="rounded-md border border-border px-3 py-1.5 text-left text-xs transition-colors hover:border-brand hover:bg-accent"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="url">Har du en eksisterende nettside? (valgfritt)</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://din-virksomhet.no"
            value={state.url}
            onChange={(e) => update("url", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Limer du inn en URL, henter vi kontekst om virksomheten automatisk.
          </p>
        </div>
        {loading ? (
          <div className="rounded-md border border-brand/30 bg-brand/5 p-4">
            <RotatingLoader messages={CRAWL_MESSAGES} />
            <p className="mt-2 text-xs text-muted-foreground">
              Dette tar vanligvis 3–10 sekunder. Vi henter så mye som mulig så
              du slipper å skrive det selv.
            </p>
          </div>
        ) : null}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            🔒 Forespørselen deles kun med matchende byråer og konsulenter — aldri offentlig.
          </p>
          <Button onClick={onSubmit} variant="brand" disabled={loading} size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Jobber…
              </>
            ) : (
              <>
                Fortsett <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Step2({
  state,
  update,
  categories,
  onBack,
  onNext,
}: {
  state: PublicWizardState;
  update: <K extends keyof PublicWizardState>(
    key: K,
    value: PublicWizardState[K],
  ) => void;
  categories: WizardCategory[];
  onBack: () => void;
  onNext: () => void;
}) {
  function toggleCategory(slug: string) {
    const set = new Set(state.selectedCategorySlugs);
    if (set.has(slug)) set.delete(slug);
    else set.add(slug);
    update("selectedCategorySlugs", Array.from(set));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stemmer dette?</CardTitle>
        <CardDescription>
          Bekreft fagområdet, så er du nesten i mål.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/*
          Brukeren skrev nettopp hva de trenger, og møtte deretter en skjerm
          som ikke bekreftet at det ble registrert. Det er en tillitslekkasje
          akkurat der forpliktelsen skal bygges — og den koster ingenting å
          tette.
        */}
        {state.userInput?.trim() ? (
          <div className="rounded-md border border-border bg-muted/40 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Du skrev
            </div>
            <p className="text-sm leading-relaxed">{state.userInput.trim()}</p>
          </div>
        ) : null}
        {state.enrichedFromUrl ? (
          <div className="flex items-center gap-2 rounded-md border border-brand/30 bg-brand/5 px-3 py-2 text-sm">
            <Sparkles className="h-4 w-4 text-brand" />
            <span>
              Auto-fylt fra{" "}
              <span className="font-mono text-xs">
                {state.enrichedFromUrl
                  .replace(/^https?:\/\//, "")
                  .replace(/\/.*$/, "")}
              </span>{" "}
              — alt er redigerbart
            </span>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label>Kategorier</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = state.selectedCategorySlugs.includes(c.slug);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.slug)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    active
                      ? "border-brand bg-brand/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/30",
                  )}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
        {/*
          Alle seks feltene under er valgfrie. De sto apne og fikk steg 2 til
          a se ut som et skjema pa seks felt, naar det egentlig bare handler
          om a bekrefte fagomradet. Byraene far uansett omfang, budsjett og
          tidsramme i steg 3 og 4.
        */}
        <details className="group rounded-md border border-border">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-muted/40">
            <span className="group-open:hidden">
              Legg til detaljer om virksomheten (valgfritt) →
            </span>
            <span className="hidden group-open:inline">
              Detaljer om virksomheten — alt er valgfritt
            </span>
          </summary>
          <div className="grid gap-4 sm:grid-cols-2 px-4 pb-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="ctxCompany">Selskap</Label>
            <Input
              id="ctxCompany"
              value={state.ctxCompanyName}
              onChange={(e) => update("ctxCompanyName", e.target.value)}
              placeholder="F.eks. Kaffebar Bergen AS"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ctxIndustry">Bransje</Label>
            <Input
              id="ctxIndustry"
              value={state.ctxIndustry}
              onChange={(e) => update("ctxIndustry", e.target.value)}
              placeholder="F.eks. Restaurant, SaaS, E-handel"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ctxOffering">Hva tilbyr dere?</Label>
            <Textarea
              id="ctxOffering"
              rows={2}
              value={state.ctxOffering}
              onChange={(e) => update("ctxOffering", e.target.value)}
              placeholder="Kort om produktet/tjenesten deres"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ctxTarget">Målgruppe</Label>
            <Input
              id="ctxTarget"
              value={state.ctxTargetAudience}
              onChange={(e) => update("ctxTargetAudience", e.target.value)}
              placeholder="Hvem er kundene deres?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ctxLocation">Lokasjon</Label>
            <Input
              id="ctxLocation"
              value={state.ctxLocation}
              onChange={(e) => update("ctxLocation", e.target.value)}
              placeholder="F.eks. Oslo"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ctxNotes">Annet byråer bør vite (valgfritt)</Label>
            <Textarea
              id="ctxNotes"
              rows={3}
              value={state.ctxNotes}
              onChange={(e) => update("ctxNotes", e.target.value)}
              placeholder="Tonalitet, nåværende teknisk setup, merkevarepreferanser…"
            />
          </div>
          </div>
        </details>
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Tilbake
          </Button>
          <Button
            variant="brand"
            size="lg"
            onClick={onNext}
            disabled={state.selectedCategorySlugs.length === 0}
          >
            Fortsett <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Step3({
  state,
  update,
  aiEnabled,
  onBack,
  onGenerateScope,
  onNext,
  loading,
  loadingMessage,
}: {
  state: PublicWizardState;
  update: <K extends keyof PublicWizardState>(
    key: K,
    value: PublicWizardState[K],
  ) => void;
  aiEnabled: boolean;
  onBack: () => void;
  onGenerateScope: () => void;
  onNext: () => void;
  loading: boolean;
  loadingMessage: string;
}) {
  function toggleDeliverable(title: string) {
    const set = new Set(state.selectedDeliverables);
    if (set.has(title)) set.delete(title);
    else set.add(title);
    update("selectedDeliverables", Array.from(set));
  }
  const hasScope = state.suggestedDeliverables.length > 0;

  // Auto-generate scope as soon as we land on this step if the user already
  // typed a goal. No button to click — users often skip optional AI actions.
  useEffect(() => {
    if (aiEnabled && state.userGoal.trim() && !hasScope && !loading) {
      onGenerateScope();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mål og omfang</CardTitle>
        <CardDescription>
          Vi bruker dette til å estimere budsjett og matche riktige byråer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="userGoal">Hva er hovedmålet med prosjektet?</Label>
          <Textarea
            id="userGoal"
            rows={3}
            value={state.userGoal}
            onChange={(e) => update("userGoal", e.target.value)}
            onBlur={() => {
              if (aiEnabled && state.userGoal.trim() && !hasScope && !loading) {
                onGenerateScope();
              }
            }}
            placeholder="F.eks. Få flere bordreservasjoner fra turister som søker på Google."
          />
        </div>
        {aiEnabled && !hasScope && loading ? (
          <div className="rounded-md border border-brand/30 bg-brand/5 p-4 text-sm">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              <Sparkles className="h-4 w-4 text-brand" /> Henter forslag til
              leveranser…
            </span>
          </div>
        ) : null}
        {hasScope ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Leveranser</Label>
              <span className="text-[10px] text-brand inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI-foreslått
              </span>
            </div>
            <div className="space-y-1.5">
              {state.suggestedDeliverables.map((d) => {
                const active = state.selectedDeliverables.includes(d.title);
                return (
                  <button
                    key={d.title}
                    type="button"
                    onClick={() => toggleDeliverable(d.title)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors",
                      active
                        ? "border-brand bg-brand/5"
                        : "border-border hover:border-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                        active
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-border",
                      )}
                    >
                      {active ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{d.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {d.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="extraDeliverable">Noe annet du trenger? (valgfritt)</Label>
          <Input
            id="extraDeliverable"
            value={state.extraDeliverable}
            onChange={(e) => update("extraDeliverable", e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Tilbake
          </Button>
          <Button
            variant="brand"
            size="lg"
            onClick={onNext}
            disabled={loading || !state.userGoal.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {loadingMessage}
              </>
            ) : (
              <>
                Fortsett <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Step4({
  state,
  update,
  onBack,
  onNext,
  loading,
  loadingMessage,
}: {
  state: PublicWizardState;
  update: <K extends keyof PublicWizardState>(
    key: K,
    value: PublicWizardState[K],
  ) => void;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
  loadingMessage: string;
}) {
  const sliderMax = useMemo(
    () =>
      Math.max(
        500_000,
        Math.round((state.budgetMaxNok * 1.5) / 10000) * 10000,
      ),
    [state.budgetMaxNok],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budsjett og tidsramme</CardTitle>
        <CardDescription>
          Juster spennet til det som er ærlig for dere. Små bedrifter bør gå
          lavt, større bedrifter kan gå høyere. Byråer kan gi bedre tilbud når
          spennet er realistisk.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <Label>Budsjettspenn</Label>
            <div className="text-right">
              <div className="text-lg font-semibold">
                {formatCurrencyNOK(state.budgetMinNok)} –{" "}
                {formatCurrencyNOK(state.budgetMaxNok)}
              </div>
              <div className="text-xs text-muted-foreground">eks. mva</div>
            </div>
          </div>
          <RangeSlider
            min={10_000}
            max={sliderMax}
            step={5000}
            valueMin={state.budgetMinNok}
            valueMax={state.budgetMaxNok}
            onChange={({ min, max }) => {
              update("budgetMinNok", min);
              update("budgetMaxNok", max);
            }}
          />
          {state.budgetRationale ? (
            <p className="text-xs text-muted-foreground">
              <Sparkles className="mr-1 inline h-3 w-3" />
              {state.budgetRationale}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Tidsramme</Label>
          <div className="grid grid-cols-2 gap-2">
            {TIMELINE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => update("timeline", option)}
                className={cn(
                  "rounded-md border p-3 text-sm transition-colors",
                  state.timeline === option
                    ? "border-brand bg-brand/5"
                    : "border-border hover:border-foreground/30",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Lokasjon / samarbeid</Label>
          <div className="space-y-2">
            {LOCATION_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => update("locationPreference", option)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border p-3 text-left text-sm transition-colors",
                  state.locationPreference === option
                    ? "border-brand bg-brand/5"
                    : "border-border hover:border-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "h-4 w-4 shrink-0 rounded-full border",
                    state.locationPreference === option
                      ? "border-brand bg-brand"
                      : "border-border",
                  )}
                />
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="extraNotes">Tilleggsnotater (valgfritt)</Label>
          <Textarea
            id="extraNotes"
            rows={3}
            value={state.extraNotes}
            onChange={(e) => update("extraNotes", e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Tilbake
          </Button>
          <Button variant="brand" size="lg" onClick={onNext} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {loadingMessage}
              </>
            ) : (
              <>
                Lag brief <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Step 5 — Review + email capture + publish
// ============================================================================

function Step5({
  state,
  update,
  onBack,
  onPublish,
  loading,
  loadingMessage,
}: {
  state: PublicWizardState;
  update: <K extends keyof PublicWizardState>(
    key: K,
    value: PublicWizardState[K],
  ) => void;
  onBack: () => void;
  onPublish: () => void;
  loading: boolean;
  loadingMessage: string;
}) {
  // Kontaktfeltene og send-knappen ligger først. Briefen er allerede generert
  // og godkjent i steg 4 — legger vi den øverst her, møter kunden en vegg av
  // tekst rett før innsending og faller fra. Den er tilgjengelig for redigering
  // under, for de som vil finpusse.
  return (
    <div className="space-y-4">
      <Card className="border-brand/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand" />
            Siste steg — hvor sender vi tilbudene?
          </CardTitle>
          <CardDescription>
            Du får en innloggingslenke på e-post. Trykk den for å se tilbudene
            som kommer inn — ingen passord å huske.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cust-name">Navn</Label>
              <Input
                id="cust-name"
                required
                value={state.customer_full_name}
                onChange={(e) => update("customer_full_name", e.target.value)}
                placeholder="Ola Nordmann"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cust-email">E-post</Label>
              <Input
                id="cust-email"
                type="email"
                required
                value={state.customer_email}
                onChange={(e) => update("customer_email", e.target.value)}
                placeholder="ola@example.com"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cust-phone">Telefon (valgfritt)</Label>
              <Input
                id="cust-phone"
                type="tel"
                value={state.customer_phone}
                onChange={(e) => update("customer_phone", e.target.value)}
                placeholder="+47 ..."
              />
              <p className="text-xs text-muted-foreground">
                Deles kun med byråer som sender tilbud, om de trenger å ringe.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-brand/40 bg-brand/5 p-3 text-sm">
            <p className="font-medium">Når du publiserer:</p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              <li>✓ Opptil 5 matchende byråer og konsulenter får forespørselen umiddelbart</li>
              <li>✓ Vi sender deg en innloggingslenke på e-post</li>
              <li>
                ✓ 100 % gratis — du betaler kun hvis du aksepterer et tilbud
              </li>
            </ul>
          </div>
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={onBack} disabled={loading}>
              <ArrowLeft className="h-4 w-4" /> Tilbake
            </Button>
            <Button
              variant="brand"
              size="lg"
              onClick={onPublish}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />{" "}
                  {loadingMessage || "Publiserer…"}
                </>
              ) : (
                "Publiser og motta tilbud"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <details className="rounded-md border border-border bg-card">
        <summary className="cursor-pointer px-6 py-4 text-sm font-medium">
          Vil du finpusse teksten byråene ser?
        </summary>
        <div className="space-y-4 border-t border-border px-6 py-4">
          <p className="text-xs text-muted-foreground">
            Dette er briefen vi sender med forespørselen. Den er allerede klar —
            rediger kun hvis du vil legge til noe.
          </p>
          <div className="space-y-2">
            <Label htmlFor="briefTitle">Tittel</Label>
            <Input
              id="briefTitle"
              value={state.briefTitle}
              onChange={(e) => update("briefTitle", e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="briefMarkdown">Innhold</Label>
            <Textarea
              id="briefMarkdown"
              rows={14}
              value={state.briefMarkdown}
              onChange={(e) => update("briefMarkdown", e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
