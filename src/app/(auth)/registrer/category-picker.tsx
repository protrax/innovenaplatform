"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type PickerCategory = { id: string; name: string };

/**
 * Fagområder må velges ved registrering, ikke etterpå. Uten minst ett
 * treffer ingen forespørsel byrået — de ville stått i katalogen og aldri
 * fått noe, uten å skjønne hvorfor.
 */
export function CategoryPicker({
  categories,
  selected,
  onToggle,
}: {
  categories: PickerCategory[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Hva leverer dere?</Label>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(c.id)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                on
                  ? "border-brand bg-brand/10 font-medium"
                  : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.length === 0
          ? "Velg minst ett — forespørsler matches på fagområde."
          : `${selected.length} valgt. Du kan endre dette senere.`}
      </p>
    </div>
  );
}
