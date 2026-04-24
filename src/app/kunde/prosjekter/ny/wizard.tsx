"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrencyNOK } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import { RotatingLoader } from "@/components/ui/rotating-loader";

const CRAWL_MESSAGES = [
  "Analyserer beskrivelsen din…",
  "Leser forsiden på nettstedet…",
  "Identifiserer bransje og målgruppe…",
  "Leser tonalitet og merkevare…",
  "Vurderer bedriftsstørrelse…",
  "Henter tekniske signaler…",
  "Setter sammen konteksten…",
];
import {
  buildBusinessContext,
  defaultState,
  LOCATION_OPTIONS,
  TIMELINE_OPTIONS,
  WIZARD_STORAGE_KEY,
  type Deliverable,
  type WizardCategory,
  type WizardState,
} from "./wizard-types";

const TOTAL_STEPS = 5;

export function Wizard({
  categories,
  aiEnabled,
}: {
  categories: WizardCategory[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount. Can't use a lazy initializer because
  // that would cause an SSR/client mismatch — the server render must use
  // defaults, and the client swaps in saved state after mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIZARD_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setState(JSON.parse(saved));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Persist on every change (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, hydrated]);

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
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
      .catch((err) => setError(err instanceof Error ? err.message : "Ukjent feil"))
      .finally(() => {
        setLoading(false);
        setLoadingMessage("");
      });
  }

  // --- Step 1 → 2: categorize + enrich in parallel
  function submitStep1() {
    if (!state.userInput.trim()) {
      setError("Skriv kort hva du trenger hjelp med");
      return;
    }
    if (!aiEnabled) {
      // Fallback: skip AI, just go to step 2 with empty enrichment
      goto(2);
      return;
    }
    runAiStep("Analyserer beskrivelsen din…", async () => {
      const tasks: Array<Promise<unknown>> = [
        postJson<{
          category_slugs: string[];
          rationale: string;
        }>("/api/wizard/categorize", { text: state.userInput }).then((cat) => {
          setState((prev) => ({
            ...prev,
            selectedCategorySlugs: cat.category_slugs,
          }));
        }),
      ];
      if (state.url.trim()) {
        setLoadingMessage("Leser nettsiden din…");
        tasks.push(
          postJson<NonNullable<WizardState["enrichment"]>>(
            "/api/wizard/enrich-url",
            { url: state.url },
          ).then((enrichment) => {
            // Assemble notes from tech stack + brand tone + anything else we
            // couldn't put in a dedicated field — user can edit freely.
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

  // --- Step 3: after user types goal, fetch scope suggestions
  function submitStep3Goal() {
    if (!state.userGoal.trim()) {
      setError("Beskriv målet med prosjektet");
      return;
    }
    if (!aiEnabled) {
      // Without AI, just let user type deliverables freely
      return;
    }
    runAiStep("Foreslår leveranser…", async () => {
      const result = await postJson<{ deliverables: Deliverable[] }>(
        "/api/wizard/suggest-scope",
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

  // --- Step 4: when entering, fetch budget estimate
  function enterStep4() {
    if (!state.userGoal.trim()) {
      setError("Beskriv målet før du går videre");
      return;
    }
    const deliverables = [...state.selectedDeliverables];
    if (state.extraDeliverable.trim()) deliverables.push(state.extraDeliverable);
    // If no specific deliverables, use the goal itself as the scope —
    // budget estimator still needs something concrete to work from.
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
      }>("/api/wizard/estimate-budget", {
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

  // --- Step 5: generate brief
  function generateBrief() {
    if (!aiEnabled) {
      // fallback — assemble a simple brief
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
      }>("/api/wizard/generate-brief", {
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
    setLoading(true);
    setLoadingMessage("Publiserer forespørselen…");
    setError(null);
    try {
      const categoryIds = categories
        .filter((c) => state.selectedCategorySlugs.includes(c.slug))
        .map((c) => c.id);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: state.briefTitle || "Ny forespørsel",
          description: state.briefMarkdown,
          budget_min_nok: state.budgetMinNok,
          budget_max_nok: state.budgetMaxNok,
          category_ids: categoryIds,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Kunne ikke publisere");

      try {
        localStorage.removeItem(WIZARD_STORAGE_KEY);
      } catch {
        // ignore
      }

      router.push(`/kunde/prosjekter/${body.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
      setLoading(false);
      setLoadingMessage("");
    }
  }

  const progressPercent = (state.step / TOTAL_STEPS) * 100;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
// Step 1 — Start
// ============================================================================

function Step1({
  state,
  update,
  onSubmit,
  loading,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hva trenger du hjelp med?</CardTitle>
        <CardDescription>
          Skriv fritt — noen setninger holder. Vi oversetter det til en tydelig
          forespørsel byråer kan svare på.
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
            Hvis du limer inn en URL, henter vi kontekst om virksomheten
            automatisk.
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
            🔒 Forespørselen din deles kun med matchende byråer — aldri offentlig.
          </p>
          <Button
            onClick={onSubmit}
            variant="brand"
            disabled={loading}
            size="lg"
          >
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

// ============================================================================
// Step 2 — Kontekst
// ============================================================================

function Step2({
  state,
  update,
  categories,
  onBack,
  onNext,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
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

  const wasEnriched = Boolean(state.enrichedFromUrl);
  const hostname = state.enrichedFromUrl
    ? state.enrichedFromUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bekreft konteksten</CardTitle>
        <CardDescription>
          {wasEnriched
            ? "Sjekk at dette stemmer — juster det som ikke gjør det."
            : "Beskriv kort virksomheten og hvem kundene er."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {wasEnriched ? (
          <div className="flex items-center gap-2 rounded-md border border-brand/30 bg-brand/5 px-3 py-2 text-sm">
            <Sparkles className="h-4 w-4 text-brand" />
            <span>
              Auto-fylt fra{" "}
              <span className="font-mono text-xs">{hostname}</span> — alt er
              redigerbart
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
          <p className="text-xs text-muted-foreground">
            Velg alle som passer — flere treff gir bedre tilbud.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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

// ============================================================================
// Step 3 — Mål & omfang
// ============================================================================

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
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
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

  // Auto-generate scope when the user arrives on this step with a goal already
  // typed. Users commonly skip optional AI buttons — make the suggestion just
  // happen.
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
            placeholder="F.eks. Få flere bordreservasjoner fra turister som søker på Google. Se mer profesjonell ut enn konkurrentene."
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
                      <span className="block text-sm font-medium">
                        {d.title}
                      </span>
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
            placeholder="F.eks. Integrasjon med eksisterende bookingsystem"
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

// ============================================================================
// Step 4 — Budsjett & detaljer
// ============================================================================

function Step4({
  state,
  update,
  onBack,
  onNext,
  loading,
  loadingMessage,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
  loadingMessage: string;
}) {
  const sliderMax = useMemo(() => {
    // Extend headroom so the user can set higher than AI estimate
    return Math.max(500_000, Math.round((state.budgetMaxNok * 1.5) / 10000) * 10000);
  }, [state.budgetMaxNok]);

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
            placeholder="Krav, preferanser, eksempler du liker…"
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
// Step 5 — Review & publish
// ============================================================================

function Step5({
  state,
  update,
  onBack,
  onPublish,
  loading,
  loadingMessage,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  onBack: () => void;
  onPublish: () => void;
  loading: boolean;
  loadingMessage: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Se over og publiser</CardTitle>
        <CardDescription>
          Dette er det byråene får se. Rediger fritt før du publiserer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
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
          <Label htmlFor="briefMarkdown">Brief</Label>
          <Textarea
            id="briefMarkdown"
            rows={16}
            value={state.briefMarkdown}
            onChange={(e) => update("briefMarkdown", e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Støtter markdown. Hold den kort og konkret.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 rounded-md border border-dashed border-border p-3 text-xs">
          <Badge variant="outline">
            Budsjett: {formatCurrencyNOK(state.budgetMinNok)}–
            {formatCurrencyNOK(state.budgetMaxNok)}
          </Badge>
          <Badge variant="outline">Tid: {state.timeline}</Badge>
          <Badge variant="outline">
            {state.selectedCategorySlugs.length} kategori(er)
          </Badge>
        </div>

        <div className="rounded-md border border-brand/40 bg-brand/5 p-3 text-sm">
          <p className="font-medium">Når du publiserer:</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <li>✓ Opptil 5 matchende byråer får forespørselen med én gang</li>
            <li>✓ Du får tilbud direkte i dashbordet ditt</li>
            <li>✓ 100% gratis — du betaler kun hvis du aksepterer et tilbud</li>
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
            disabled={
              loading || !state.briefTitle.trim() || !state.briefMarkdown.trim()
            }
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
  );
}
