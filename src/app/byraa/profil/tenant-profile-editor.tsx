"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  tagline: string | null;
  founded_year: number | null;
  team_size: string | null;
  location: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  org_number: string | null;
}

interface CaseStudy {
  id: string;
  title: string;
  client_name: string | null;
  description: string | null;
  challenge: string | null;
  solution: string | null;
  result: string | null;
  cover_image_url: string | null;
  project_url: string | null;
  published: boolean;
  sort_order: number;
}

export function TenantProfileEditor({
  tenant,
  caseStudies: initialCaseStudies,
}: {
  tenant: Tenant;
  caseStudies: CaseStudy[];
}) {
  const router = useRouter();
  const [t, setT] = useState(tenant);
  const [caseStudies, setCaseStudies] = useState(initialCaseStudies);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Tenant>(key: K, value: Tenant[K]) {
    setT((prev) => ({ ...prev, [key]: value }));
  }

  async function save(patch: Partial<Tenant>) {
    setError(null);
    const res = await fetch(`/api/tenants/${t.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Kunne ikke lagre");
      return;
    }
    setSavedAt(new Date());
    router.refresh();
  }

  async function uploadLogo(file: File) {
    setUploadingLogo(true);
    setError(null);
    try {
      const signRes = await fetch(`/api/tenants/${t.id}/logo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, mime_type: file.type }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) {
        setError(sign.error ?? "Kunne ikke forberede opplasting");
        return;
      }
      const up = await fetch(sign.upload_url, {
        method: "PUT",
        headers: file.type ? { "content-type": file.type } : {},
        body: file,
      });
      if (!up.ok) {
        setError(`Opplasting feilet (${up.status})`);
        return;
      }
      update("logo_url", `${sign.public_url}?t=${Date.now()}`);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function addCaseStudy() {
    const res = await fetch("/api/case-studies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant_id: t.id,
        title: "Ny case study",
        description: "",
      }),
    });
    const body = await res.json();
    if (res.ok) {
      setCaseStudies([...caseStudies, body.case_study]);
    }
  }

  async function updateCaseStudy(id: string, patch: Partial<CaseStudy>) {
    setCaseStudies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
    await fetch(`/api/case-studies/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteCaseStudy(id: string) {
    await fetch(`/api/case-studies/${id}`, { method: "DELETE" });
    setCaseStudies((prev) => prev.filter((c) => c.id !== id));
  }

  async function uploadCaseStudyCover(caseStudyId: string, file: File) {
    const signRes = await fetch(`/api/case-studies/${caseStudyId}/cover`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: file.name, mime_type: file.type }),
    });
    const sign = await signRes.json();
    if (!signRes.ok) return;
    await fetch(sign.upload_url, {
      method: "PUT",
      headers: file.type ? { "content-type": file.type } : {},
      body: file,
    });
    setCaseStudies((prev) =>
      prev.map((c) =>
        c.id === caseStudyId
          ? { ...c, cover_image_url: `${sign.public_url}?t=${Date.now()}` }
          : c,
      ),
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle>Merkevare</CardTitle>
          <CardDescription>Logo og kjerneinfo som vises øverst på profilsiden.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-6">
            {t.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.logo_url}
                alt={t.name}
                className="h-24 w-24 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-accent text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
            <div>
              <label className="inline-flex">
                <Button asChild variant="outline" disabled={uploadingLogo}>
                  <span>
                    {uploadingLogo ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Laster opp…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />{" "}
                        {t.logo_url ? "Bytt logo" : "Last opp logo"}
                      </>
                    )}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadLogo(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                PNG, SVG eller JPG. Kvadratisk, minst 400×400 px for beste resultat.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Selskapsnavn</Label>
              <Input
                id="name"
                value={t.name}
                onChange={(e) => update("name", e.target.value)}
                onBlur={() => save({ name: t.name })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org">Organisasjonsnummer</Label>
              <Input
                id="org"
                value={t.org_number ?? ""}
                onChange={(e) => update("org_number", e.target.value || null)}
                onBlur={() => save({ org_number: t.org_number })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="tagline">Tagline (én setning)</Label>
              <Input
                id="tagline"
                maxLength={200}
                value={t.tagline ?? ""}
                onChange={(e) => update("tagline", e.target.value || null)}
                onBlur={() => save({ tagline: t.tagline })}
                placeholder="F.eks. Vi bygger digitale produkter folk faktisk bruker"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Om oss</Label>
              <Textarea
                id="description"
                rows={6}
                value={t.description ?? ""}
                onChange={(e) => update("description", e.target.value || null)}
                onBlur={() => save({ description: t.description })}
                placeholder="Fortell hvem dere er, hvordan dere jobber, og hva dere er best på."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Lokasjon</Label>
              <Input
                id="location"
                value={t.location ?? ""}
                onChange={(e) => update("location", e.target.value || null)}
                onBlur={() => save({ location: t.location })}
                placeholder="F.eks. Oslo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team">Teamstørrelse</Label>
              <Input
                id="team"
                value={t.team_size ?? ""}
                onChange={(e) => update("team_size", e.target.value || null)}
                onBlur={() => save({ team_size: t.team_size })}
                placeholder="F.eks. 5–10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="founded">Grunnlagt</Label>
              <Input
                id="founded"
                type="number"
                min={1900}
                max={2100}
                value={t.founded_year ?? ""}
                onChange={(e) =>
                  update(
                    "founded_year",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                onBlur={() => save({ founded_year: t.founded_year })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Nettside</Label>
              <Input
                id="website"
                type="url"
                value={t.website ?? ""}
                onChange={(e) => update("website", e.target.value || null)}
                onBlur={() => save({ website: t.website })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input
                id="linkedin"
                type="url"
                value={t.linkedin_url ?? ""}
                onChange={(e) => update("linkedin_url", e.target.value || null)}
                onBlur={() => save({ linkedin_url: t.linkedin_url })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                type="url"
                value={t.instagram_url ?? ""}
                onChange={(e) => update("instagram_url", e.target.value || null)}
                onBlur={() => save({ instagram_url: t.instagram_url })}
              />
            </div>
          </div>
          {savedAt ? (
            <p className="text-xs text-muted-foreground">
              Sist lagret {savedAt.toLocaleTimeString("nb-NO")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Case studies */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Referanseprosjekter</CardTitle>
              <CardDescription>
                Vis hva dere har levert. Publiserte cases vises på profilsiden
                og syndikeres til innovena.no.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addCaseStudy}>
              <Plus className="h-4 w-4" /> Ny case
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {caseStudies.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Ingen referanseprosjekter ennå. Legg til for å bygge tillit hos
              nye kunder.
            </p>
          ) : (
            caseStudies.map((cs) => (
              <CaseStudyEditor
                key={cs.id}
                caseStudy={cs}
                onUpdate={(patch) => updateCaseStudy(cs.id, patch)}
                onDelete={() => deleteCaseStudy(cs.id)}
                onUploadCover={(file) => uploadCaseStudyCover(cs.id, file)}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CaseStudyEditor({
  caseStudy: cs,
  onUpdate,
  onDelete,
  onUploadCover,
}: {
  caseStudy: CaseStudy;
  onUpdate: (patch: Partial<CaseStudy>) => Promise<void>;
  onDelete: () => Promise<void>;
  onUploadCover: (file: File) => Promise<void>;
}) {
  const [local, setLocal] = useState(cs);
  const [uploading, setUploading] = useState(false);

  function patch<K extends keyof CaseStudy>(key: K, value: CaseStudy[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          {local.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={local.cover_image_url}
              alt=""
              className="h-24 w-32 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-24 w-32 items-center justify-center rounded-md bg-accent text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
          <label className="mt-2 inline-flex">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={uploading}
            >
              <span>
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Upload className="h-3 w-3" /> Bilde
                  </>
                )}
              </span>
            </Button>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setUploading(true);
                  await onUploadCover(f);
                  setUploading(false);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Input
              value={local.title}
              onChange={(e) => patch("title", e.target.value)}
              onBlur={() => onUpdate({ title: local.title })}
              className="h-8 text-base font-medium"
              placeholder="Case-tittel"
            />
            <div className="flex items-center gap-1">
              <Button
                variant={local.published ? "brand" : "outline"}
                size="sm"
                onClick={() => {
                  patch("published", !local.published);
                  onUpdate({ published: !local.published });
                }}
              >
                {local.published ? (
                  <>
                    <Eye className="h-3 w-3" /> Publisert
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3 w-3" /> Kladd
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Input
            value={local.client_name ?? ""}
            onChange={(e) => patch("client_name", e.target.value || null)}
            onBlur={() => onUpdate({ client_name: local.client_name })}
            placeholder="Kundenavn (valgfritt)"
            className="h-8 text-sm"
          />

          <Textarea
            rows={3}
            value={local.description ?? ""}
            onChange={(e) => patch("description", e.target.value || null)}
            onBlur={() => onUpdate({ description: local.description })}
            placeholder="Kort beskrivelse av prosjektet"
          />

          <div className="grid gap-2 sm:grid-cols-3">
            <Textarea
              rows={2}
              value={local.challenge ?? ""}
              onChange={(e) => patch("challenge", e.target.value || null)}
              onBlur={() => onUpdate({ challenge: local.challenge })}
              placeholder="Utfordring"
              className="text-xs"
            />
            <Textarea
              rows={2}
              value={local.solution ?? ""}
              onChange={(e) => patch("solution", e.target.value || null)}
              onBlur={() => onUpdate({ solution: local.solution })}
              placeholder="Løsning"
              className="text-xs"
            />
            <Textarea
              rows={2}
              value={local.result ?? ""}
              onChange={(e) => patch("result", e.target.value || null)}
              onBlur={() => onUpdate({ result: local.result })}
              placeholder="Resultat"
              className="text-xs"
            />
          </div>

          <Input
            type="url"
            value={local.project_url ?? ""}
            onChange={(e) => patch("project_url", e.target.value || null)}
            onBlur={() => onUpdate({ project_url: local.project_url })}
            placeholder="Prosjekt-URL (valgfritt)"
            className="h-8 text-sm"
          />
        </div>
      </div>
      {local.published ? null : (
        <Badge
          variant="outline"
          className="mt-2 inline-flex px-1.5 py-0 text-[10px]"
        >
          Ikke synlig utad
        </Badge>
      )}
    </div>
  );
}
