"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FaqItem {
  q: string;
  a: string;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const open = openIdx === i;
        return (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-border bg-background transition-colors"
          >
            <button
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-muted/30"
              aria-expanded={open}
            >
              <span className="font-semibold">{item.q}</span>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-180 text-brand",
                )}
              />
            </button>
            {open ? (
              <div className="border-t border-border bg-muted/10 px-6 py-5 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
