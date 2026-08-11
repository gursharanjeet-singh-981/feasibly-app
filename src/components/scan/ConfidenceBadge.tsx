"use client";

import { cn } from "@/lib/utils";

interface Props {
  confidence: number;
  pages?: string[];
  source?: "scan" | "ai" | "heuristic";
  className?: string;
}

export function ConfidenceBadge({ confidence, pages, className }: Props) {
  const tier = tierFor(confidence);
  const label = tier === "high" ? "High" : tier === "medium" ? "Medium" : "Low";
  const pct = Math.round(confidence * 100);
  const title = pages && pages.length
    ? `Auto-selected · ${label} confidence (${pct}%) · Found on: ${pages.join(", ")}`
    : `Auto-selected · ${label} confidence (${pct}%)`;

  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        tier === "high" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tier === "medium" && "border-amber-200 bg-amber-50 text-amber-700",
        tier === "low" && "border-rose-200 bg-rose-50 text-rose-700",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          tier === "high" && "bg-emerald-500",
          tier === "medium" && "bg-amber-500",
          tier === "low" && "bg-rose-500",
        )}
      />
      {label}
    </span>
  );
}

function tierFor(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}