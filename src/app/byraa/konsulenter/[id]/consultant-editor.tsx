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
import { cn, formatCurrencyNOK } from "@/lib/utils";
import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";

interface Consultant {
  id: string;
  slug: string;
  tenant_id: string;
  full_name: string;
  title: string | null;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  hourly_rate_nok: number | null;
  years_experience: number | null;
  available_from: string | null;
  available_hours_per_week: number | null;
  visible_in_marketplace: boolean;
  linkedin_url: string | null;
  portfolio_url: string | null;
  location: string | null;
  languages: string[] | null;
  cv_storage_path: string | null;
  cv_filename: string | null;
}

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface Skill {
  category_id: string | null;
  skill_name: string | null;
  category_name: string | null;
}

export function ConsultantEditor({
  consultant,
  skills: initialSkills,
  categories,
}: {
  consultant: Consultant;
  skills: Skill[];
  categories: Category[];
}) {
  const router = useRouter();
  const [c, setC] = useState(consultant);
  const [skills, setSkills] = useState(initialSkills);
  const [newSkill, setNewSkill] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Consultant>(key: K, value: Consultant[K]) {
    setC((prev) => ({ ...prev, [key]: value }));
  }

  async function saveProfile(patch: Partial<Consultant>) {
    setSavingProfile(true);
    setError(null);
    try {
      const res = await fetch(`/api/consultants/${c.id}`, {
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
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadAvatar(file: File) {
    setUploadingAvatar(true);
    setError(null);
    try {
      const signRes = await fetch(`/api/consultants/${c.id}/avatar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mime_type: file.type,
        }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) {
        setError(sign.error ?? "Kunne ikke forberede opplasting");
        return;
      }
      const uploadRes = await fetch(sign.upload_url, {
        method: "PUT",
        headers: file.type ? { "content-type": file.type } : {},
        body: file,
      });
      if (!uploadRes.ok) {
        setError(`Opplasting feilet (${uploadRes.status})`);
        return;
      }
      // Cache-bust the URL so the new avatar shows immediately
      update("avatar_url", `${sign.public_url}?t=${Date.now()}`);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function uploadCv(file: File) {
    setUploadingCv(true);
    setError(null);
    try {
      const signRes = await fetch(`/api/consultants/${c.id}/cv`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mime_type: file.type,
        }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) {
        setError(sign.error ?? "Kunne ikke forberede opplasting");
        return;
      }
      const uploadRes = await fetch(sign.upload_url, {
        method: "PUT",
        headers: file.type ? { "content-type": file.type } : {},
        body: file,
      });
      if (!uploadRes.ok) {
        setError(`Opplasting feilet (${uploadRes.status})`);
        return;
      }
      update("cv_filename", file.name);
      update("cv_storage_path", sign.path);
    } finally {
      setUploadingCv(false);
    }
  }

  async function addSkill(kind: "category" | "freeform", value: string) {
    if (!value.trim()) return;
    const body =
      kind === "category"
        ? { category_id: value }
        : { skill_name: value.trim() };
    const res = await fetch(`/api/consultants/${c.id}/skills`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const category =
        kind === "category" ? categories.find((x) => x.id === value) : null;
      setSkills([
        ...skills,
        {
          category_id: kind === "category" ? value : null,
          skill_name: kind === "freeform" ? value.trim() : null,
          category_name: category?.name ?? null,
        },
      ]);
      setNewSkill("");
    }
  }

  async function removeSkill(skill: Skill) {
    const params = new URLSearchParams();
    if (skill.category_id) params.set("category_id", skill.category_id);
    if (skill.skill_name) params.set("skill_name", skill.skill_name);
    await fetch(`/api/consultants/${c.id}/skills?${params}`, {
      method: "DELETE",
    });
    setSkills(
      skills.filter((s) =>
        skill.category_id
          ? s.category_id !== skill.category_id
          : s.skill_name !== skill.skill_name,
      ),
    );
  }

  async function toggleVisibility() {
    const next = !c.visible_in_marketplace;
    update("visible_in_marketplace", next);
    await saveProfile({ visible_in_marketplace: next });
  }

  const categoryIdsSelected = new Set(
    skills.filter((s) => s.category_id).map((s) => s.category_id as string),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{c.full_name}</h2>
          <p className="text-sm text-muted-foreground">
            Offentlig URL:{" "}
            <a
              href={`/konsulenter/${c.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-brand underline-offset-2 hover:underline"
            >
              /konsulenter/{c.slug}
            </a>
            {c.visible_in_marketplace ? null : (
              <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[10px]">
                skjult
              </Badge>
            )}
          </p>
        </div>
        <Button
          variant={c.visible_in_marketplace ? "outline" : "brand"}
          onClick={toggleVisibility}
          disabled={savingProfile}
        >
          {c.visible_in_marketplace ? (
            <>
              <EyeOff className="h-4 w-4" /> Skjul fra markedsplass
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" /> Publiser i markedsplass
            </>
          )}
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle>Profilbilde</CardTitle>
          <CardDescription>Vises i markedsplassen og på profilsiden.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {c.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.avatar_url}
                alt={c.full_name}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-xl font-medium text-muted-foreground">
                {c.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
            )}
            <div>
              <label className="inline-flex">
                <Button asChild variant="outline" disabled={uploadingAvatar}>
                  <span>
                    {uploadingAvatar ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Laster opp…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" /> Last opp bilde
                      </>
                    )}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAvatar(file);
                    e.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                JPG, PNG eller WebP. Gjerne kvadratisk og minst 400×400 px.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            Disse feltene vises offentlig. Oppdateringer lagres automatisk når
            feltet mister fokus.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Fullt navn</Label>
            <Input
              id="name"
              value={c.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              onBlur={() => saveProfile({ full_name: c.full_name })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Tittel</Label>
            <Input
              id="title"
              value={c.title ?? ""}
              onChange={(e) => update("title", e.target.value || null)}
              onBlur={() => saveProfile({ title: c.title })}
              placeholder="F.eks. Senior Frontendutvikler"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Sted</Label>
            <Input
              id="location"
              value={c.location ?? ""}
              onChange={(e) => update("location", e.target.value || null)}
              onBlur={() => saveProfile({ location: c.location })}
              placeholder="F.eks. Oslo"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="headline">Ingress (én setning)</Label>
            <Input
              id="headline"
              value={c.headline ?? ""}
              onChange={(e) => update("headline", e.target.value || null)}
              onBlur={() => saveProfile({ headline: c.headline })}
              maxLength={200}
              placeholder="Fanger oppmerksomheten på markedsplassen"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bio">Om meg</Label>
            <Textarea
              id="bio"
              rows={6}
              value={c.bio ?? ""}
              onChange={(e) => update("bio", e.target.value || null)}
              onBlur={() => saveProfile({ bio: c.bio })}
              placeholder="Erfaring, hvem du hjelper best, arbeidsstil…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate">Timepris (NOK)</Label>
            <Input
              id="rate"
              type="number"
              min={0}
              value={c.hourly_rate_nok ?? ""}
              onChange={(e) =>
                update(
                  "hourly_rate_nok",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              onBlur={() => saveProfile({ hourly_rate_nok: c.hourly_rate_nok })}
            />
            {c.hourly_rate_nok ? (
              <p className="text-xs text-muted-foreground">
                {formatCurrencyNOK(c.hourly_rate_nok)} / time
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="years">Års erfaring</Label>
            <Input
              id="years"
              type="number"
              min={0}
              max={70}
              value={c.years_experience ?? ""}
              onChange={(e) =>
                update(
                  "years_experience",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              onBlur={() =>
                saveProfile({ years_experience: c.years_experience })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="available-from">Tilgjengelig fra</Label>
            <Input
              id="available-from"
              type="date"
              value={c.available_from ?? ""}
              onChange={(e) => update("available_from", e.target.value || null)}
              onBlur={() => saveProfile({ available_from: c.available_from })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hours">Ledige timer/uke</Label>
            <Input
              id="hours"
              type="number"
              min={0}
              max={80}
              value={c.available_hours_per_week ?? ""}
              onChange={(e) =>
                update(
                  "available_hours_per_week",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              onBlur={() =>
                saveProfile({
                  available_hours_per_week: c.available_hours_per_week,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              type="url"
              value={c.linkedin_url ?? ""}
              onChange={(e) => update("linkedin_url", e.target.value || null)}
              onBlur={() => saveProfile({ linkedin_url: c.linkedin_url })}
              placeholder="https://linkedin.com/in/…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="portfolio">Portefølje / nettside</Label>
            <Input
              id="portfolio"
              type="url"
              value={c.portfolio_url ?? ""}
              onChange={(e) => update("portfolio_url", e.target.value || null)}
              onBlur={() => saveProfile({ portfolio_url: c.portfolio_url })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Språk</Label>
            <LanguageInput
              values={c.languages ?? []}
              onChange={(next) => {
                update("languages", next);
                saveProfile({ languages: next });
              }}
            />
          </div>
          {savedAt ? (
            <div className="text-xs text-muted-foreground sm:col-span-2">
              Sist lagret {savedAt.toLocaleTimeString("nb-NO")}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle>Ferdigheter</CardTitle>
          <CardDescription>
            Velg fra Innovena-kategoriene og legg til spesifikke ferdigheter som
            fritekst (f.eks. Next.js, Google Ads, React Native).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Kategorier</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const active = categoryIdsSelected.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      if (active) {
                        const skill = skills.find(
                          (s) => s.category_id === cat.id,
                        );
                        if (skill) removeSkill(skill);
                      } else {
                        addSkill("category", cat.id);
                      }
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      active
                        ? "border-brand bg-brand/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/30",
                    )}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Spesifikke ferdigheter</Label>
            <div className="flex flex-wrap gap-2">
              {skills
                .filter((s) => s.skill_name)
                .map((s) => (
                  <span
                    key={s.skill_name}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm"
                  >
                    {s.skill_name}
                    <button
                      type="button"
                      onClick={() => removeSkill(s)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Fjern"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill("freeform", newSkill);
                  }
                }}
                placeholder="Skriv en ferdighet og trykk Enter"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addSkill("freeform", newSkill)}
                disabled={!newSkill.trim()}
              >
                Legg til
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CV */}
      <Card>
        <CardHeader>
          <CardTitle>CV</CardTitle>
          <CardDescription>
            PDF eller Word. CV-en er privat — den vises kun til innloggede kunder
            som ber om den.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {c.cv_storage_path ? (
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">
                    {c.cv_filename ?? "CV"}
                  </div>
                  <div className="text-xs text-muted-foreground">Opplastet</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                  <a href={`/api/consultants/${c.id}/cv`}>
                    <Download className="h-4 w-4" /> Last ned
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    saveProfile({
                      cv_storage_path: null,
                      cv_filename: null,
                    })
                  }
                  className="hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
          <div className="mt-3">
            <label className="inline-flex">
              <Button asChild variant="outline" disabled={uploadingCv}>
                <span>
                  {uploadingCv ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Laster opp…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />{" "}
                      {c.cv_storage_path ? "Bytt CV" : "Last opp CV"}
                    </>
                  )}
                </span>
              </Button>
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadCv(file);
                  e.target.value = "";
                }}
                className="sr-only"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild variant="ghost" size="sm">
          <a
            href={`/konsulenter/${c.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Forhåndsvis offentlig profil <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>
    </div>
  );
}

function LanguageInput({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {values.map((lang) => (
          <span
            key={lang}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm"
          >
            {lang}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== lang))}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Fjern"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              onChange([...values, input.trim()]);
              setInput("");
            }
          }}
          placeholder="F.eks. Norsk, Engelsk"
        />
      </div>
    </div>
  );
}
