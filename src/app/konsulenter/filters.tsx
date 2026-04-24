"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

interface Category {
  id: string;
  slug: string;
  name: string;
}

export function MarketplaceFilters({
  categories,
  current,
}: {
  categories: Category[];
  current: {
    category?: string;
    q?: string;
    available_now?: string;
    min_rate?: string;
    max_rate?: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    router.push(`/konsulenter?${next.toString()}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const next = new URLSearchParams();
        for (const [k, v] of formData.entries()) {
          if (v) next.set(k, String(v));
        }
        router.push(`/konsulenter?${next.toString()}`);
      }}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="q">Søk</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="q"
            name="q"
            defaultValue={current.q ?? ""}
            className="pl-8"
            placeholder="F.eks. Next.js"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Kategori</Label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setParam("category", undefined)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
              !current.category
                ? "border-brand bg-brand/10 text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30",
            )}
          >
            Alle
          </button>
          {categories.map((cat) => {
            const active = current.category === cat.slug;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setParam("category", cat.slug)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
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
        <Label>Timepris (NOK)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            name="min_rate"
            type="number"
            min={0}
            defaultValue={current.min_rate ?? ""}
            placeholder="Fra"
          />
          <Input
            name="max_rate"
            type="number"
            min={0}
            defaultValue={current.max_rate ?? ""}
            placeholder="Til"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="available_now"
            value="true"
            defaultChecked={current.available_now === "true"}
            className="h-4 w-4"
          />
          Tilgjengelig nå
        </label>
      </div>

      <Button type="submit" variant="brand" className="w-full">
        Oppdater filter
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => router.push("/konsulenter")}
      >
        Nullstill
      </Button>
    </form>
  );
}
