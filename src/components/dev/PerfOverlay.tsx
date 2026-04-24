/**
 * Phase 5 — Developer-only Web Vitals overlay.
 *
 * Activate with `?perf=1` or `localStorage.setItem('perfOverlay', '1')`.
 * Renders nothing when disabled (single boolean check, zero render cost).
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { getLiveValues, subscribeLive } from "@/lib/perfTelemetry";

const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
  fcp: { good: 1800, poor: 3000 },
  ttfb: { good: 800, poor: 1800 },
} as const;

type VitalKey = keyof typeof THRESHOLDS;

function gradeColor(key: VitalKey, v: number | undefined): string {
  if (v === undefined) return "text-muted-foreground";
  const t = THRESHOLDS[key];
  if (v <= t.good) return "text-primary";
  if (v <= t.poor) return "text-foreground";
  return "text-destructive";
}

function fmt(key: VitalKey, v: number | undefined): string {
  if (v === undefined) return "—";
  return key === "cls" ? v.toFixed(3) : `${Math.round(v)}ms`;
}

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("perf") === "1") return true;
    if (window.localStorage.getItem("perfOverlay") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function PerfOverlay() {
  const [enabled, setEnabled] = useState(false);

  // Re-evaluate on mount only — toggling requires a reload (cheap & explicit).
  useEffect(() => {
    setEnabled(isEnabled());
  }, []);

  const live = useSyncExternalStore(subscribeLive, getLiveValues, getLiveValues);

  if (!enabled) return null;

  const items: VitalKey[] = ["lcp", "inp", "cls", "fcp", "ttfb"];

  return (
    <div
      role="status"
      aria-label="Performance overlay"
      className="fixed bottom-4 right-4 z-[9999] rounded-lg border border-border bg-background/95 backdrop-blur px-3 py-2 shadow-lg text-xs font-mono pointer-events-none"
    >
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground uppercase tracking-wide">perf</span>
        {items.map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className="text-muted-foreground uppercase">{k}</span>
            <span className={gradeColor(k, live[k])}>{fmt(k, live[k])}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
