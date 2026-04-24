

## Phase 5 — Web Vitals telemetry + performance budget

Phases 1–4 are live: caching, bundle splitting, realtime bus, virtualization, indexes + RPCs. The system is now fast — but we have **no visibility** into whether it stays fast as features ship. Phase 5 closes the loop: a lightweight in-app telemetry layer that captures Core Web Vitals and slow-query signals, plus a developer-facing perf overlay so regressions surface immediately.

### Outcome

- Every page load reports Core Web Vitals (LCP, INP, CLS, TTFB, FCP) to a `performance_metrics` table — searchable per route/user/company.
- Slow Supabase queries (>1 s) and slow React renders (>200 ms long tasks) are logged with route + component context.
- Admins get a **Performance Dashboard** at `/admin/performance` showing p50/p75/p95 by route, top slow queries, and trend over the last 7/30 days.
- Developer-only floating overlay (toggle via `?perf=1`) shows live LCP/INP/CLS for the current page during QA — zero overhead in normal use.

### Standards applied

- **Google Web Vitals thresholds**: LCP <2.5 s, INP <200 ms, CLS <0.1 (good); >4 s / >500 ms / >0.25 (poor).
- **W3C `PerformanceObserver`**: native browser API for `largest-contentful-paint`, `event`, `layout-shift`, `longtask`, `navigation` entries — no third-party SDK.
- **`web-vitals` library** (Google, ~2 KB gzipped): canonical INP/LCP/CLS measurement; lazy-loaded so it never blocks initial paint.
- **Sampling**: 100% in dev, 10% in production (configurable) to keep insert volume bounded.
- **Privacy**: only route path, viewport, vital values, and anonymized user/company IDs — no PII, no URL query strings.

### Changes

#### A) Telemetry capture — `src/lib/perfTelemetry.ts` (new)

Lazy-imports `web-vitals` after first paint, registers `onLCP`, `onINP`, `onCLS`, `onTTFB`, `onFCP`. Each callback batches into a 5-second buffer, then flushes via a single `supabase.from('performance_metrics').insert([...])` call (uses the realtime bus pattern for batched writes — never one insert per metric).

Also installs a `PerformanceObserver` for `longtask` entries (>200 ms) and tags them with the current route from `react-router`.

```ts
initPerfTelemetry({
  sampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  getContext: () => ({ route: location.pathname, companyId, userId }),
});
```

Mounted once in `src/main.tsx` after `createRoot` — never blocks startup.

#### B) Slow-query interceptor — `src/integrations/supabase/perfClient.ts` (new)

Wraps the existing `supabase` client with a thin proxy that times every `.rpc()` and `.from().select()` call. Anything >1 s is recorded to the same telemetry buffer with `{ kind: 'slow_query', table_or_rpc, duration_ms, route }`.

Zero behaviour change to the client API — drop-in replacement re-exported from `src/integrations/supabase/client.ts`.

#### C) Database tables + RPC — new migration

```sql
CREATE TABLE public.performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  metric_kind text NOT NULL,           -- 'lcp' | 'inp' | 'cls' | 'ttfb' | 'fcp' | 'longtask' | 'slow_query'
  metric_value numeric NOT NULL,        -- ms (or unitless for CLS)
  route text NOT NULL,
  company_id uuid,
  user_id uuid,
  context jsonb,                        -- { table, rpc, viewport, ... }
  CHECK (metric_kind IN ('lcp','inp','cls','ttfb','fcp','longtask','slow_query'))
);

-- composite indexes per Phase 4 standard
CREATE INDEX idx_perf_metrics_route_recorded
  ON public.performance_metrics (route, recorded_at DESC);
CREATE INDEX idx_perf_metrics_kind_recorded
  ON public.performance_metrics (metric_kind, recorded_at DESC);

ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can INSERT their own metrics
CREATE POLICY "users insert own perf metrics" ON public.performance_metrics
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only admins can SELECT (dashboard consumers)
CREATE POLICY "admins read perf metrics" ON public.performance_metrics
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
```

**RPC `get_performance_summary(p_days int default 7)`** (`SECURITY INVOKER`) — returns p50/p75/p95 per `(route, metric_kind)` over the window, plus top 20 slow queries. One round-trip for the whole dashboard.

#### D) Admin Performance Dashboard — `src/pages/admin/PerformanceDashboard.tsx` (new)

Registered in `src/constants/moduleConfig.ts` under Admin. Three sections:

1. **Core Web Vitals by route** — table with route, p50/p75/p95 LCP, INP, CLS; colour-coded against Google thresholds (green/amber/red).
2. **Slow queries** — top 20 RPCs/tables by p95 latency with call count.
3. **Long tasks** — routes where p75 long-task count >5/page, indicating render-side bottlenecks.

Uses `<VirtualTable>` (Phase 3) for the slow-query list, time-range selector (24h / 7d / 30d), CSV export for offline analysis.

#### E) Developer perf overlay — `src/components/dev/PerfOverlay.tsx` (new)

Activated by `?perf=1` query param or `localStorage.perfOverlay = '1'`. Floating bottom-right card shows live LCP / INP / CLS / current-route long-task count, refreshed via the same `web-vitals` callbacks. Zero render cost when not enabled (early return on a single boolean).

#### F) Route change instrumentation — `src/App.tsx`

Hook into `react-router`'s `useLocation` to call `perfTelemetry.markRouteChange(pathname)` so SPA navigations get their own LCP/INP measurements (web-vitals v4 supports soft-nav).

### Files

**New**
- `src/lib/perfTelemetry.ts` — capture + batching layer.
- `src/integrations/supabase/perfClient.ts` — slow-query interceptor.
- `src/components/dev/PerfOverlay.tsx` — floating dev overlay.
- `src/pages/admin/PerformanceDashboard.tsx` — admin UI.
- `src/hooks/usePerformanceSummary.ts` — TanStack Query hook for the RPC.

**Modified**
- `src/main.tsx` — `initPerfTelemetry()` after mount.
- `src/App.tsx` — route-change marker + `<PerfOverlay />` (renders null unless flag).
- `src/integrations/supabase/client.ts` — re-export proxied client.
- `src/constants/moduleConfig.ts` — register `/admin/performance` route.

**New migration**
- `supabase/migrations/<ts>_phase5_performance_telemetry.sql` — table, indexes, RLS, `get_performance_summary` RPC.

**Memory**
- New: `mem://performance/web-vitals-budget` — "Targets: LCP <2.5 s, INP <200 ms, CLS <0.1. Telemetry batched 5 s, sampled 10% in prod. Slow-query threshold 1 s."
- Update Core line in `mem://index.md` referencing the dashboard.

### Out of scope

- External APM (Datadog/Sentry) — defer until volume justifies cost.
- Per-user funnel analytics — this is perf only, not product analytics.
- Server-side function timing — Supabase already exposes this in `function_edge_logs`; the dashboard can link to it but won't duplicate.

### Verification

1. Load any route → within 5 s, a row appears in `performance_metrics` with `metric_kind='lcp'`, sane value, correct route.
2. Append `?perf=1` to the URL → floating overlay appears with live LCP/INP/CLS values matching Chrome DevTools' Web Vitals panel.
3. `/admin/performance` shows p75 LCP per route, with green badges where <2.5 s; non-admin users get 403/redirect.
4. Trigger a slow query (e.g., a deliberate `pg_sleep(1.2)` in dev) → row appears with `metric_kind='slow_query'` and the RPC name in `context.rpc`.
5. `EXPLAIN ANALYZE` on `get_performance_summary(7)` runs in <200 ms (composite indexes used).
6. Production bundle size delta: `web-vitals` adds ≤2.5 KB gzipped to its own async chunk; main bundle unchanged.
7. With telemetry on, no measurable LCP regression vs Phase 4 baseline (verified via the dashboard itself after rollout).

