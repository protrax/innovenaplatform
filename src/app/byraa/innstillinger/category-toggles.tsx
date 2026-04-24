"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

export function CategoryToggles({
  tenantId,
  categories,
  initial,
}: {
  tenantId: string;
  categories: Category[];
  initial: string[];
}) {
  const [active, setActive] = useState<Set<string>>(new Set(initial));
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(categoryId: string) {
    const next = new Set(active);
    const adding = !next.has(categoryId);
    if (adding) next.add(categoryId);
    else next.delete(categoryId);
    setActive(next);

    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/tenants/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          category_id: categoryId,
          active: adding,
        }),
      });
      if (!res.ok) {
        // Revert on error
        setActive((prev) => {
          const reverted = new Set(prev);
          if (adding) reverted.delete(categoryId);
          else reverted.add(categoryId);
          return reverted;
        });
        const body = await res.json().catch(() => ({ error: "Ukjent feil" }));
        setError(body.error ?? "Kunne ikke oppdatere kategori");
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const isActive = active.has(c.id);
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => toggle(c.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                isActive
                  ? "border-brand bg-brand/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
