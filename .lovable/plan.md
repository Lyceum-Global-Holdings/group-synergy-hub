# Obsidian Data Matrix Dashboard — Light Theme

Build the approved Obsidian Data Matrix layout with 6 new material-flow charts, rendered on a **light** background (not the originally proposed dark zinc-900 surface). All existing pillars, business logic, and RBAC stay intact.

## Visual direction (light)

- Page surface: `bg-background` (existing light token) with a subtle `bg-muted/30` grid backdrop.
- Cards: white surfaces, `border border-border`, soft `shadow-sm`, 1px hairline dividers.
- Accent rails on tiles: `border-l-2` using `primary`, `warning`, `destructive`, `success` semantic tokens.
- Numerics: monospace `font-mono tabular-nums`, large hero metrics in `text-foreground`.
- Micro-labels: uppercase `text-[10px] tracking-[0.14em] text-muted-foreground`.
- Charts: Recharts with semantic HSL tokens (primary / success / warning / destructive / muted); light gridlines via `hsl(var(--border))`.
- No `data-theme="obsidian"` override — page uses the standard light shell so it matches the rest of the app.

## New charts (all from existing tables, no schema changes)

1. **Material Flow — 14d** dual area: issued vs returned (`material_issue_items` + `material_return_items`)
2. **Inbound vs Outbound — 30d** stacked bars: GRN vs Issue per day (`grn_items` + `material_issue_items`)
3. **Top 5 Issued Items — 30d** horizontal bars (`material_issue_items` grouped by `item_id`)
4. **Top 5 Returned Items — 30d** horizontal bars, warning tone (`material_return_items` grouped by `item_id`)
5. **Stock Movement Mix — 7d** donut by `stock_transactions.transaction_type`
6. **PO Spend Trend — 12 weeks** area chart (`purchase_orders.total_amount` weekly)

## Backend

- **New RPC** `public.get_dashboard_analytics(p_company_id uuid, p_location_id uuid default null)` — SECURITY INVOKER, returns single `jsonb` with all six datasets. Respects existing RLS; location filter optional.
- No table or column changes.

## Frontend

- **Hook**: extend `src/hooks/useDashboardPulse.ts` with `useDashboardAnalytics(companyId, locationId)` — React Query, `staleTime: 30_000`.
- **New components** under `src/components/dashboard/`:
  - `AnalyticsGrid.tsx` — bento layout wrapper
  - `MaterialFlowChart.tsx` (Recharts AreaChart)
  - `InboundOutboundChart.tsx` (stacked BarChart)
  - `TopItemsBarList.tsx` (horizontal bars, reused for issued + returned)
  - `MovementMixDonut.tsx` (PieChart)
  - `SpendTrendChart.tsx` (AreaChart)
- **`src/pages/Dashboard.tsx`**: mount `<AnalyticsGrid />` below the existing pillar grid and above Construction. Existing `PillarCard` / `HealthStrip` keep their current light styling.

## Guardrails

- Semantic tokens only — no hardcoded colors.
- Finance-restricted figures continue to honour existing admin gating.
- All queries via the new RPC + existing hooks; no direct table reads added.
- Recharts already in the project — no new dependencies.

## Order of operations

1. Run the `get_dashboard_analytics` migration.
2. After approval + regenerated types, add the hook and the 6 chart components.
3. Wire `AnalyticsGrid` into `Dashboard.tsx`.
