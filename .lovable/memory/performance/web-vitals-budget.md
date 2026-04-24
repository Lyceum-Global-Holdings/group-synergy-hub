---
name: Web Vitals performance budget
description: Targets and telemetry rules for Core Web Vitals capture and slow-query detection
type: feature
---
**Targets** (Google thresholds):
- LCP <2.5s good / <4s ok / >4s poor
- INP <200ms good / <500ms ok / >500ms poor
- CLS <0.1 good / <0.25 ok / >0.25 poor

**Telemetry rules**:
- All vitals + longtask + slow_query rows go to `public.performance_metrics`.
- Sampling: 100% in dev, 10% in prod (set in `src/main.tsx` via `initPerfTelemetry`).
- Buffer: 5s flush interval, max 50 rows per batch — never one insert per metric.
- Slow-query threshold: 1000ms; intercepted via `installPerfInterceptor` on the supabase client.
- Long-task threshold: 200ms via `PerformanceObserver({ type: 'longtask' })`.

**Privacy**: only route path, viewport, and anonymized user/company IDs. Never URL query strings or PII.

**Dev overlay**: `?perf=1` or `localStorage.perfOverlay='1'` shows live LCP/INP/CLS bottom-right. Renders null when disabled — zero overhead.

**Dashboard**: `/admin/performance` (admin/super_admin only) — uses `get_performance_summary(p_days)` RPC. Time windows: 1d / 7d / 30d.
