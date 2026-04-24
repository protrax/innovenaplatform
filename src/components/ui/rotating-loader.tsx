"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Cycles through a list of messages while async work is in flight.
// Each message is visible for `intervalMs`, with a soft fade between them.
export function RotatingLoader({
  messages,
  intervalMs = 1800,
  className,
}: {
  messages: string[];
  intervalMs?: number;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % messages.length);
        setFading(false);
      }, 200);
    }, intervalMs);
    return () => clearInterval(t);
  }, [messages, intervalMs]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />
      <span
        className={cn(
          "transition-opacity duration-200",
          fading ? "opacity-0" : "opacity-100",
        )}
      >
        {messages[idx] ?? ""}
      </span>
    </div>
  );
}
