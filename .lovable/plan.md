## Goal

Add a global **"As-of Date"** filter to the Resource Allocation module (and its three sub-modules: Labour, Inventory, Subcontractors), defaulting to **today** on every page entry. This implements **time-phased resource availability** per **PMI PMBOK § 9 (Resource Management)** and **ISO 21500/21502** scheduling standards — the same model used by SAP PS, Oracle Primavera, and MS Project.

## International Standard Applied

**Date-effective ("as-of date") filtering**, where a record is visible on date `D` if:
```
start_date <= D  AND  (end_date IS NULL OR end_date >= D)
```

This is the canonical *resource availability window* semantics. Combined with **ISO 8601 date format** (`YYYY-MM-DD`) and the user's **local timezone** (matches the existing `LiveClock` component), it gives a reliable "what is allocated right now" view that auditors and project managers expect.

The filter always **resets to today** on navigation (does not persist across sessions) — matching SAP Fiori's "Today by default, user can override" pattern. A **"Today"** quick-reset button is always visible.

## What the User Will See

1. A new **date filter bar** at the top of `/construction/resource-allocation` and each sub-page, showing:
   - A date picker (default = today, ISO 8601 display: `Sat, 26 Apr 2026`)
   - A **"Today"** button (highlighted when active)
   - Quick presets: **Yesterday · Today · Tomorrow · This Week · This Month**
   - A subtle indicator: *"Showing resources active on 26 Apr 2026"*
2. The 3 KPI cards on the parent page (Labour / Inventory / Subcontractor counts) recalculate to count only resources **active on the selected date**.
3. Sub-pages filter their tables/dashboards by the same date.
4. The selected date propagates to sub-pages via a shared context (and via a `?date=YYYY-MM-DD` URL param for shareable links).

## Scope per Sub-Module

| Sub-module | Filter applied to | Date column |
|---|---|---|
| **Parent (ResourceAllocation.tsx)** | KPI counts on 3 cards | `start_date` / `end_date` on `construction_resources` |
| **Subcontractors** | Allocation View table | `start_date` / `end_date` |
| **Labour → Allocation View** | Dashboard, Labour-Wise, Location-Wise sub-tabs | `start_date` / `end_date` on resources; `attendance_date` for attendance widgets |
| **Labour → Master List** | Not date-filtered (master data is timeless) | — |
| **Inventory → Allocation Dashboard / Inventory-Wise / Location-Wise** | Stock-on-hand snapshot as of date (transactions ≤ date) | `transaction_date` on stock movements |
| **Inventory → Transfers / Service & Repair** | Filter rows where `transaction_date` ≤ as-of date | `transaction_date` |
| **Inventory → Item Master** | Not date-filtered | — |

Master lists (Labour Master, Item Master, Subcontractor Master) are intentionally **not** date-filtered — they're reference data, not allocations.

## Technical Design

### 1. New shared context: `ResourceDateContext`

`src/contexts/ResourceDateContext.tsx`

```ts
interface ResourceDateContextValue {
  asOfDate: Date;              // always a valid Date, defaults to today
  setAsOfDate: (d: Date) => void;
  resetToToday: () => void;
  isToday: boolean;
  asOfDateISO: string;         // YYYY-MM-DD for queries
}
```
- Mounted in `ResourceAllocation.tsx` (and re-mounted on each sub-page) so the default re-resolves to "today" on every entry.
- Reads/writes `?date=YYYY-MM-DD` URL param via `useSearchParams` for deep linking. Invalid/missing param → today.
- Exposes `useResourceDate()` hook.

### 2. New shared component: `<AsOfDateBar />`

`src/components/construction/AsOfDateBar.tsx`
- Calendar icon + Shadcn DatePicker (Popover + Calendar with `pointer-events-auto`)
- Quick-preset buttons (Yesterday, Today, Tomorrow, This Week, This Month)
- "Today" reset button (visible when `!isToday`, primary variant)
- Active-date badge: `Showing resources active on {format(date, 'EEE, dd MMM yyyy')}`
- Compact responsive layout (collapses presets into a dropdown < 768px)

### 3. Reusable filter helper

`src/lib/construction/dateEffective.ts`
```ts
export function isActiveOn<T extends { start_date?: string|null; end_date?: string|null }>(
  row: T, asOfISO: string
): boolean {
  const start = row.start_date ?? null;
  const end = row.end_date ?? null;
  if (start && start > asOfISO) return false;
  if (end && end < asOfISO) return false;
  return true;
}
```
String comparison on ISO 8601 dates is safe and timezone-stable.

### 4. Hook updates

- **`useConstructionResources`**: accept optional `{ asOfDate?: string }`; when provided, push the effective-date predicate to Supabase:
  ```ts
  .or(`start_date.is.null,start_date.lte.${asOf}`)
  .or(`end_date.is.null,end_date.gte.${asOf}`)
  ```
  This keeps filtering server-side (better with RLS + pagination).
- **Inventory transaction queries** (`useConstructionInventory.ts`, `AllocationDashboard.tsx`): add `transaction_date <= asOf` predicate.
- **Labour attendance views**: pre-fill `attendance_date` filter with `asOf`.

### 5. Page integration

- `ResourceAllocation.tsx`: wrap in `<ResourceDateProvider>`, render `<AsOfDateBar />` above the existing controls row, recompute the 3 card counts via `isActiveOn`. Pass `?date=` through navigation `onClick` so sub-pages inherit the date.
- `SubcontractorResources.tsx`, `LabourResources.tsx`, `InventoryItems.tsx`: each wraps in its own `<ResourceDateProvider>` (reading `?date=` from URL → today fallback), renders `<AsOfDateBar />` above the Tabs, threads `asOfDate` into hooks/views.
- Inventory `AllocationDashboard`, `InventoryWiseView`, `LocationWiseView`, `TransfersView`, `ServiceRepairView`: accept `asOfDate` prop and apply to their queries.
- Labour `LabourDashboard`, `LabourWiseView`, `LabourLocationWiseView`: same treatment.

### 6. Defaulting & Reset Rules (Standards)

1. On every page **mount**, `asOfDate` resolves in this order:
   (a) `?date=YYYY-MM-DD` query param if valid; otherwise
   (b) **today** in user's local timezone (`new Date()` truncated to date).
2. The date is **never** persisted to localStorage — fresh visit = today.
3. Each navigation between sibling sub-pages preserves the selected date via URL param.
4. Returning to `/construction/resource-allocation` from any other module resets to today (no `?date=` in fresh navigation).

### 7. Accessibility & i18n

- `<AsOfDateBar />` uses `aria-label="Resource allocation as-of date"`.
- Date format respects locale via `date-fns/format` (`PPP` token) — currently English; ready for i18n later.
- All quick-preset buttons keyboard-navigable.

## Files to Create

- `src/contexts/ResourceDateContext.tsx`
- `src/components/construction/AsOfDateBar.tsx`
- `src/lib/construction/dateEffective.ts`

## Files to Edit

- `src/pages/construction/ResourceAllocation.tsx` — wrap with provider, add bar, filter KPI counts, propagate `?date=` to nav
- `src/pages/construction/resources/LabourResources.tsx` — wrap, add bar, pass date down
- `src/pages/construction/resources/InventoryItems.tsx` — wrap, add bar, pass date down
- `src/pages/construction/resources/SubcontractorResources.tsx` — wrap, add bar, filter table
- `src/hooks/construction/useConstructionResources.ts` — accept `asOfDate` and apply server-side predicate
- `src/components/construction/labour/LabourDashboard.tsx`, `LabourWiseView.tsx`, `LabourLocationWiseView.tsx` — consume `useResourceDate()`
- `src/components/construction/inventory/AllocationDashboard.tsx`, `InventoryWiseView.tsx`, `LocationWiseView.tsx`, `TransfersView.tsx`, `ServiceRepairView.tsx` — consume `useResourceDate()` and apply to transaction queries

## Out of Scope (future work, not part of this change)

- Persisting user's preferred date across sessions (intentionally avoided per standard)
- Date-range mode (we use a single as-of date — the standard for snapshot views; range mode belongs to reports)
- Backfilling historical `start_date`/`end_date` for existing resources (records with NULL dates are treated as "always active", matching ERP convention)
