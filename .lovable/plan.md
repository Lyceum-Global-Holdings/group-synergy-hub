## Plan: Modernize Operations Pulse Dashboard

User skipped the direction picker, so I'll implement **Direction 3 — Precision Canvas** (the most aligned with the project's existing SAP Fiori / Oracle Redwood enterprise design language already recorded in project memory). It gives:

- Crisp panel headers with section labels + accent rail
- JetBrains Mono numerics for data-grade legibility
- Tight 5-tile health strip with left-rail status accent for alerts
- Two-column pillar grid with header bar, hero metric, sparkline / progress, and a striped key-value list
- A refreshed Construction section using the same panel grammar

### Scope (frontend only)
1. `src/pages/Dashboard.tsx` — restructure layout, add section labels, switch hero header to enterprise cockpit style.
2. `src/components/dashboard/PillarCard.tsx` — adopt panel-header bar with accent rail; tighten HeroMetric and SecondaryStat to the precision style (mono numerics, divider rows).
3. `src/components/dashboard/HealthStrip.tsx` — restyle to 5 equal tiles with icon chip top-left, monospace value top-right, uppercase micro label, left-rail when destructive/warning.
4. `src/components/dashboard/Sparkline.tsx` — light polish (stroke + soft fill), no API change.
5. `src/index.css` — add a single `--font-mono` token alias if missing; no palette changes.

### Guardrails
- **No data/business-logic changes.** All hooks, RPCs, props, and routes stay identical.
- **Semantic tokens only** — no hardcoded `text-white`, `bg-slate-*`, hex values. Use existing `--primary`, `--muted`, `--success`, `--warning`, `--destructive`, `--border`, `--card`. The prototype's slate/indigo/rose visuals map to the project's already-defined tokens.
- Keep all existing sections: header, health strip, 4 pillars, Construction grid.
- Admin-gated Finance pillar stays admin-gated.
- Light mode primary; dark mode preserved via tokens.

### Technical notes
- Mono numerics via `font-mono` Tailwind utility (already wired through `tailwind.config.ts`).
- Accent rail = `border-l-2 border-destructive` (or warning) on threshold-breached tiles, driven by existing `tone` prop on `SecondaryStat`.
- No new dependencies.

After implementation I'll verify visually via `browser--view_preview` at 1440 width.