# Performance Remediation — Staged Plan

Production telemetry over the last 7 days shows we are failing every Google Core Web Vitals threshold on most routes (LCP up to 83 s, INP up to 4.5 s, FCP up to 55 s, CLS 0.4–0.66). Long-task samples are dominated by `warehouse_items` and `warehouse_bin_allocations` renders, which matches the routes scoring worst.

We will fix this in five stages aligned with **Google Core Web Vitals (2024 INP standard)**, **RAIL** model, **W3C Resource Hints**, and **HTTP Archive Almanac** guidance. Each stage is independently shippable and instrumented — the existing `/admin/performance` dashboard is the acceptance gate.

## Targets per stage (p75 across routes)

| Stage | LCP | INP | CLS | FCP | TTFB |
|------|-----|-----|-----|-----|------|
| Today | 34–83 s | up to 4.5 s | 0.40–0.66 | 15–55 s | 1.5–3.5 s |
| 1 — Network shell | <8 s | — | — | <4 s | <1.5 s |
| 2 — JS budget | <4 s | <500 ms | — | <2.5 s | — |
| 3 — Heavy lists | — | <200 ms | — | — | — |
| 4 — Layout & assets | <2.5 s | — | <0.1 | <1.8 s | <800 ms |
| 5 — Data layer | maintain | maintain | maintain | maintain | <600 ms |

## Stage 1 — Network shell (TTFB + FCP) ✦ 1 day

The TTFB on `/` is 3.2 s and FCP 16 s — the HTML and root bundle aren't reaching the browser fast enough.

- Add `<link rel="preload" as="script">` for the entry chunk in `index.html`.
- Add `<link rel="modulepreload">` for the `react-vendor` and `radix-vendor` chunks.
- Add `<link rel="preconnect">` to the Supabase URL (so the first auth + telemetry round-trips don't pay DNS/TLS cost).
- Inline a tiny `<style>` critical-shell (background + loader) so users see something within 1 s while React hydrates.
- Add `<link rel="preload" as="image" fetchpriority="high">` for the login logo (LCP element on `/auth`).
- Set `Cache-Control: public, max-age=31536000, immutable` headers on hashed assets via `vite-plugin-html` or hosting config; `index.html` stays `no-cache`.

## Stage 2 — JavaScript budget (LCP + INP) ✦ 2 days

Inventory, Item-Bin master, GRN and Bin Allocations ship hundreds of KB of JS before paint.

- **Route-level dynamic imports for heavy vendor libs**: `recharts`, `jspdf`, `html2canvas`, `exceljs`, `mermaid`, `three`/`@react-three/*`. Today they sit in `manualChunks` but are still imported eagerly by some pages — convert every import site to `await import(...)` triggered on user action (open export menu, click "Generate PDF", open chart tab).
- Remove `@react-three/fiber`, `@react-three/drei`, `three`, and `mermaid` from any code that ships to the warehouse routes. They are admin-only — move under `/admin` lazy routes.
- Replace synchronous `xlsx`/`exceljs` usage with a Worker (`new Worker(new URL(..., import.meta.url), { type: 'module' })`) so spreadsheet generation never blocks INP.
- Add `vite-plugin-compression` (brotli + gzip) so transport size matches modern CDN expectations.
- Add a route-aware preloader: on hover/focus of sidebar links, call the matching `import()` (router-level `preload()` pattern). Cuts perceived LCP on navigation.

## Stage 3 — Heavy list rendering (INP) ✦ 2 days

Long-task contexts show `warehouse_items` and `warehouse_bin_allocations` as the dominant offenders.

- Audit every list ≥ 200 rows and ensure it goes through the shared `VirtualTable` (memory rule already exists; this stage enforces it across `BinAllocationsTab`, `ItemMasterTab`, `GrnLinesTable`, `BatchManagementTab`, `PartialQuantitiesTab`).
- Replace inline `.filter().map()` filter chains in render with `useMemo` + a single typed reducer; precompute display strings once per row.
- Convert search inputs to **`useDeferredValue` + `useTransition`** so typing never blocks input (INP). Debounce server queries at 250 ms.
- Add stable `key`s based on row UUID — kill any `key={index}` usage, which forces VDOM diff cascades.
- Wrap expensive cell renderers (`StatusBadge`, `CreatedByCell`, formatted currency) in `React.memo` with primitive props only.
- For BinAllocations specifically: switch to the `list_bin_allocations` RPC keyset pagination (already in DB) and stop fetching all rows.

## Stage 4 — Layout stability & assets (CLS + FCP) ✦ 1 day

CLS on `/sourcing/supplier-registration`, `/item-bin-master`, and `/batch-management` is 0.39–0.66 (red).

- Reserve dimensions for every `<img>`, avatar, and chart container (explicit `width`/`height` or `aspect-ratio`).
- Fonts: serve self-hosted Inter / SF subset via `font-display: swap` with `<link rel="preload" as="font" type="font/woff2" crossorigin>`.
- Skeletons must match the final element box (height + min-width), not collapse to zero.
- Replace remaining PNG hero/marketing images with **AVIF + WebP** via `vite-imagetools`, served with `<picture>`.
- Defer below-the-fold images with `loading="lazy"` and `decoding="async"`.
- Audit late-arriving banners / toasts / TurnstileWidget — render them in a fixed-height portal slot instead of injecting into the document flow.

## Stage 5 — Data layer (TTFB + sustained INP) ✦ 2 days

Supabase round-trips dominate after the JS budget is fixed.

- Convert remaining hot lists (Inventory, BinAllocations, GRN lines, PR/PO lists) to **SECURITY INVOKER list RPCs** returning flat rows — already standard per project memory; finish the rollout.
- Add covering indexes per `[DB Index Strategy]` for any list still doing `Seq Scan` per `EXPLAIN`.
- Move `useRealtimeStockUpdates` invalidations behind a 500 ms coalescing debounce — currently triggers a stampede of refetches per WebSocket frame.
- Set `staleTime: 60_000` on truly static lookups (units, categories, companies, locations, bin types) — they refetch on every navigation today.
- Add `prefetchQuery` calls on sidebar hover for the 5 most-used pages so the data arrives during route transition.

## Cross-stage instrumentation

- The `/admin/performance` dashboard is the single source of truth. Each stage's PR description must include before/after screenshots for the routes it touched.
- Add a **performance budget CI check** (`vite-plugin-bundle-analyzer` + `size-limit`) that fails the build if the route-entry JS for `/warehouse/inventory`, `/warehouse/bin-allocations`, `/`, `/warehouse/item-bin-master`, or `/sourcing/supplier-registration` regresses by more than 10 %.
- Add a `prefers-reduced-motion` guard around any `framer-motion`/large transition so low-power devices stop spending INP budget on animation.

## Out of scope

- Visual redesign — the design system stays as-is.
- New features. This is purely performance work.
- SSR / streaming. The app is a Vite SPA; switching to a server-rendered framework is a separate decision the user has not requested.

## Verification matrix (per stage)

```text
Stage 1 done when: /, /auth, /warehouse/inventory FCP < 4s, TTFB < 1.5s p75
Stage 2 done when: every route initial JS < 250 KB gz; INP < 500 ms p75
Stage 3 done when: warehouse_items + warehouse_bin_allocations no longer appear in top-10 longtask contexts
Stage 4 done when: every route CLS < 0.1 p75
Stage 5 done when: TTFB < 600 ms p75 on all warehouse routes
```

All measurements taken from `performance_metrics` over the same 7-day window as the screenshot.
