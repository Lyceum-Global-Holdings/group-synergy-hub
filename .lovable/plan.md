
# Modern Realtime Operations Dashboard

## Problem with current `/dashboard`

- KPIs (`Total Purchase Orders`, `Active Suppliers`, `Pending Approvals`, `Monthly Spend`), Department Module Status bars, and Recent Activities are **all hardcoded mock data** in `src/pages/Dashboard.tsx`.
- No realtime subscriptions — the "Last updated" badge just shows the page-load time.
- Layout is a flat stack of cards, no domain grouping, no drill-down, no trend context.

## Goal

Replace the mock dashboard with a **modular, realtime "Operations Pulse"** that streams live data from existing tables (`purchase_orders`, `goods_receipts`, `warehouse_items`, `stock_transactions`, `rfqs`, `suppliers`, `approvals`, etc.) and lays it out the way a COO actually reads an enterprise: **Pulse → Domain Pillars → Live Activity → Drill-down**.

## Proposed layout

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Operations Pulse                  [● Live]  [Today ▾] [Location ▾] │
├─────────────────────────────────────────────────────────────────────┤
│  HEALTH STRIP (5 mini-KPIs with sparklines + delta vs yesterday)    │
│  Orders Today | GRNs Pending | Stock Alerts | RFQs Open | Approvals │
├──────────────────────────────────┬──────────────────────────────────┤
│  WAREHOUSE pillar                │  PROCUREMENT pillar              │
│  - On-hand value (live)          │  - PO pipeline funnel            │
│  - Low-stock count + top 5 list  │  - Spend vs budget gauge         │
│  - Bin moves (24h sparkline)     │  - Avg PO cycle time             │
├──────────────────────────────────┼──────────────────────────────────┤
│  SOURCING pillar                 │  FINANCE pillar                  │
│  - Open RFQs + days-to-close     │  - AR aging donut                │
│  - Supplier scorecard top/bottom │  - Cash position + 7d trend      │
│  - 3-way match exceptions        │  - Pending payments              │
├──────────────────────────────────┴──────────────────────────────────┤
│  LIVE ACTIVITY FEED (realtime stream, grouped by module, filterable)│
└─────────────────────────────────────────────────────────────────────┘
```

Each pillar card: title row with module icon, 1 hero metric, 1 secondary metric, 1 inline sparkline/mini-chart, and a "View module →" link that deep-links into the relevant page (e.g. `/warehouse/inventory?filter=low-stock`).

## Realtime mechanism

Use the existing `useRealtimeChannel` bus (already standard per memory: *Realtime Bus Pattern*). Each pillar subscribes to its own scoped channel and invalidates only its React Query keys — no full-page refetch.

- Warehouse pillar → `stock_transactions`, `warehouse_items`, `bin_allocations`
- Procurement pillar → `purchase_orders`, `purchase_order_items`, `goods_receipts`
- Sourcing pillar → `rfqs`, `rfq_responses`, `suppliers`, `supplier_scorecards`
- Finance pillar → `invoices`, `payments`, `journal_entries`
- Activity feed → `audit_logs` (filtered to last 50, append on insert)

A small **"● Live"** indicator pulses when a realtime event arrives in the last 5 seconds, then settles. Replaces the static "Last updated" badge.

## Data hooks (new, server-aggregated)

To keep the dashboard fast and avoid client-side aggregation across thousands of rows, create one RPC per pillar that returns a flat summary row. Pattern matches existing *List RPC Pattern* memory.

- `get_dashboard_warehouse_pulse(p_company_id, p_location_id)` → on_hand_value, low_stock_count, moves_24h, sparkline_7d[]
- `get_dashboard_procurement_pulse(p_company_id, p_location_id)` → po_open, po_approved_today, spend_mtd, budget_mtd, avg_cycle_days, funnel{}
- `get_dashboard_sourcing_pulse(p_company_id)` → rfqs_open, rfqs_closing_7d, top_suppliers[], bottom_suppliers[], match_exceptions
- `get_dashboard_finance_pulse(p_company_id)` → ar_aging{}, cash_position, payments_pending, trend_7d[]
- `get_dashboard_health_strip(p_company_id, p_location_id)` → 5 KPIs + their yesterday deltas + 7d sparkline arrays

All `SECURITY INVOKER`, company-scoped, respect `LocationFilterContext`.

## Filters (header)

- Location (already wired to `LocationFilterContext`)
- Time window: Today / 7d / 30d / MTD (default Today)
- Company (already wired to `CompanyContext`)

State persists in URL query string so dashboards are shareable.

## Visual treatment

- Reuse existing semantic tokens; no new colors.
- Sparklines via `recharts` `<LineChart>` mini variant (already in dep tree).
- Donut + gauge via `recharts` `RadialBarChart` / `PieChart`.
- Subtle pulse animation on the "● Live" dot using existing Tailwind `animate-pulse`.
- Density: pillar cards are equal-height, 2-up on `lg`, 1-up on mobile. Health strip is 5-up on `xl`, scrollable horizontally on small.

## Files to touch

### New
- `src/components/dashboard/HealthStrip.tsx`
- `src/components/dashboard/PillarCard.tsx` (shared shell: title, hero, secondary, sparkline slot, CTA)
- `src/components/dashboard/WarehousePillar.tsx`
- `src/components/dashboard/ProcurementPillar.tsx`
- `src/components/dashboard/SourcingPillar.tsx`
- `src/components/dashboard/FinancePillar.tsx`
- `src/components/dashboard/LiveActivityFeed.tsx`
- `src/components/dashboard/LivePulseIndicator.tsx`
- `src/hooks/useDashboardPulse.ts` (5 query hooks, one per RPC)
- `supabase/migrations/<ts>_dashboard_pulse_rpcs.sql`

### Edited
- `src/pages/Dashboard.tsx` — replace mock body with the new layout; keep location/company header.

### Untouched
- Module pages, RBAC, RLS, existing realtime hooks.

## Out of scope (can be follow-ups)

- User-customizable widget drag-and-drop (the existing `dashboards/` widget framework already handles that for management dashboards — this is the fixed "home" dashboard).
- Alert thresholds configuration UI.
- Export-to-PDF of the dashboard snapshot.

## Open question

Before I build, one clarification: do you want the Finance pillar included on the home dashboard for all roles, or should it be **role-gated** (e.g. only Finance/Admin see it) given finance data sensitivity? I'd default to role-gated using the existing `has_role` check.
