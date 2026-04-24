"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Simple min/max range slider built on two <input type="range"> — no extra deps.
export function RangeSlider({
  min,
  max,
  step = 1000,
  valueMin,
  valueMax,
  onChange,
  className,
}: {
  min: number;
  max: number;
  step?: number;
  valueMin: number;
  valueMax: number;
  onChange: (next: { min: number; max: number }) => void;
  className?: string;
}) {
  function handleMin(e: React.ChangeEvent<HTMLInputElement>) {
    const next = Math.min(Number(e.target.value), valueMax - step);
    onChange({ min: next, max: valueMax });
  }
  function handleMax(e: React.ChangeEvent<HTMLInputElement>) {
    const next = Math.max(Number(e.target.value), valueMin + step);
    onChange({ min: valueMin, max: next });
  }
  const span = max - min || 1;
  const left = ((valueMin - min) / span) * 100;
  const right = 100 - ((valueMax - min) / span) * 100;

  return (
    <div className={cn("relative pt-6 pb-2", className)}>
      <div className="relative h-1.5 rounded-full bg-secondary">
        <div
          className="absolute h-1.5 rounded-full bg-brand"
          style={{ left: `${left}%`, right: `${right}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMin}
        onChange={handleMin}
        className="absolute inset-x-0 top-5 h-5 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMax}
        onChange={handleMax}
        className="absolute inset-x-0 top-5 h-5 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow"
      />
    </div>
  );
}
