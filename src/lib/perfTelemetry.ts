/**
 * Phase 5 — Performance telemetry capture layer.
 *
 * Lazy-loads `web-vitals` after first paint and ships LCP/INP/CLS/TTFB/FCP
 * plus longtask + slow-query signals to public.performance_metrics in batched
 * inserts. Sampled (10% prod / 100% dev) and buffered (5s) so it never adds
 * meaningful network or main-thread cost.
 *
 * Standards:
 *  - Google Web Vitals thresholds (LCP <2.5s, INP <200ms, CLS <0.1)
 *  - W3C PerformanceObserver for `longtask`
 *  - Privacy: no URL query strings, no PII; only path + anonymized IDs
 */

import { supabase } from "@/integrations/supabase/client";

type MetricKind = "lcp" | "inp" | "cls" | "ttfb" | "fcp" | "longtask" | "slow_query";

interface MetricRow {
  metric_kind: MetricKind;
  metric_value: number;
  route: string;
  company_id: string | null;
  user_id: string | null;
  context: Record<string, unknown> | null;
}

interface TelemetryConfig {
  sampleRate: number;
  getContext: () => { route: string; companyId: string | null; userId: string | null };
}

const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER = 50;

let buffer: MetricRow[] = [];
let flushTimer: number | null = null;
let initialized = false;
let currentConfig: TelemetryConfig | null = null;
let currentRoute = typeof location !== "undefined" ? location.pathname : "/";

// Live values for the dev overlay
const liveValues: Partial<Record<MetricKind, number>> = {};
const liveSubscribers = new Set<() => void>();

function notifyLive() {
  liveSubscribers.forEach((fn) => fn());
}

export function subscribeLive(cb: () => void): () => void {
  liveSubscribers.add(cb);
  return () => liveSubscribers.delete(cb);
}

export function getLiveValues(): Partial<Record<MetricKind, number>> {
  return { ...liveValues };
}

function shouldSample(): boolean {
  if (!currentConfig) return false;
  return Math.random() < currentConfig.sampleRate;
}

async function flush() {
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  try {
    // Filter rows missing user_id — RLS requires it
    const valid = batch.filter((r) => r.user_id);
    if (valid.length === 0) return;
    // Cast: our `context` is a plain object; the generated type expects Json.
    await supabase.from("performance_metrics").insert(valid as any);
  } catch (err) {
    // Telemetry must never break the app
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[perfTelemetry] flush failed", err);
    }
  }
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(flush, FLUSH_INTERVAL_MS);
}

function record(kind: MetricKind, value: number, extraContext?: Record<string, unknown>) {
  if (!currentConfig) return;
  liveValues[kind] = value;
  notifyLive();

  if (!shouldSample()) return;
  const ctx = currentConfig.getContext();
  buffer.push({
    metric_kind: kind,
    metric_value: Number.isFinite(value) ? Number(value.toFixed(4)) : 0,
    route: ctx.route || currentRoute,
    company_id: ctx.companyId,
    user_id: ctx.userId,
    context: {
      viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : null,
      ...(extraContext ?? {}),
    },
  });
  if (buffer.length >= MAX_BUFFER) {
    void flush();
  } else {
    scheduleFlush();
  }
}

export function recordSlowQuery(target: string, durationMs: number, kind: "rpc" | "table") {
  record("slow_query", durationMs, { [kind]: target });
}

export function markRouteChange(pathname: string) {
  currentRoute = pathname;
}

export function initPerfTelemetry(config: TelemetryConfig) {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  currentConfig = config;

  // Lazy import web-vitals so it never blocks initial paint
  import("web-vitals")
    .then(({ onLCP, onINP, onCLS, onTTFB, onFCP }) => {
      onLCP((m) => record("lcp", m.value));
      onINP((m) => record("inp", m.value));
      onCLS((m) => record("cls", m.value));
      onTTFB((m) => record("ttfb", m.value));
      onFCP((m) => record("fcp", m.value));
    })
    .catch(() => {
      /* web-vitals optional — ignore failure */
    });

  // Long-task observer (>200ms)
  try {
    if ("PerformanceObserver" in window) {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration >= 200) {
            record("longtask", entry.duration, { name: entry.name });
          }
        }
      });
      obs.observe({ type: "longtask", buffered: true });
    }
  } catch {
    /* longtask not supported in some browsers */
  }

  // Flush on page hide / unload
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  window.addEventListener("pagehide", () => void flush());
}
