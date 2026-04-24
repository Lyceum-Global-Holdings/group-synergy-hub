

## Fix garbled table layout + truly-live Item Master sync

### Outcome

1. The candidate table inside **Import from Item Master** renders cleanly — header columns line up with body cells, no overlapping text — at 14k+ rows with smooth scrolling.
2. The list updates **automatically** when items are added/edited/deleted in Item Master *or* when tools are created elsewhere — without reopening the dialog.

### Root causes

**1. Garbled cells (the screenshot)**
The virtualized branch sets `<TableBody style="display:block">` and `<TableRow style="display:table; table-layout:fixed; width:100%">` while the `<TableHeader>` is left as native `display:table-header-group`. Because the body is no longer part of the same `<table>` formatting context, header column widths and row column widths are computed independently, so:
- All body cells fall back to natural widths, the first column absorbs the overflow,
- Rows are absolutely positioned but their internal `<td>`s have no explicit widths, so text from every column collapses on top of the Item Code column.

This is a known anti-pattern when virtualizing inside a semantic `<table>`. The fix per WAI-ARIA APG "Grid" + the TanStack Virtual docs is to either (a) use a **CSS Grid layout** on rows with the same template applied to the header, or (b) keep the table but use **`position: sticky`** padding rows (top/bottom spacers) instead of absolute positioning on every row. Option (b) preserves the native `<table>` column algorithm — header and body widths align automatically — and is the simpler, more accessible fix.

**2. Not auto-refreshing in practice**
- `warehouse_tools` is **not in the `supabase_realtime` publication** (verified). So when a tool is created from another tab/device, neither `existingToolKeys` (de-dup) nor the tool list updates — promoted items appear to "linger".
- The dialog's own realtime subscription on `warehouse_items` correctly invalidates the candidate query, but on `INSERT` the payload's `company_id` arrives only when `REPLICA IDENTITY FULL` is set, so the client-side `effectiveCompanyIds` filter inside the handler can drop legitimate inserts (the safer pattern is to invalidate on every change and let the query refetch with its scope filter — the network cost is negligible since results are paged).
- The query has no `staleTime`/`refetchOnWindowFocus` override; by project default it's fresh, but combined with the missing publication for tools it still feels stale.

### Changes

#### A) Table layout — replace absolute-positioned virtual rows with sticky spacers

In `ImportFromItemMasterDialog.tsx`, virtualized branch:

- Remove `display:block` on `<TableBody>` and remove `display:table / position:absolute / transform` on each `<TableRow>`.
- Render two **spacer `<tr>`s** with a single full-width `<td colSpan={8}>` to reserve the height above and below the visible window:
  - `paddingTop = virtualItems[0].start`
  - `paddingBottom = totalSize - virtualItems[last].end`
- Render only the visible `virtualItems` as normal `<TableRow>`s in between.
- Add `colgroup` with explicit widths for the 8 columns (checkbox 40, code 140, name 280, category 200, company 200, unit 80, current 110, qty 130) so header and body always line up regardless of viewport. Total ≥ 1180 → keep `min-w-[1180px]` on `<Table>` so horizontal scroll engages on narrow screens (WCAG 1.4.10).
- Keep `<TableHeader className="sticky top-0 bg-background z-10">`.

This restores native table column-width sharing → no more cell overlap.

#### B) Realtime — make `warehouse_tools` actually broadcast and de-dup live

- **Migration**: add `warehouse_tools` to the realtime publication and set `REPLICA IDENTITY FULL` on both tables so DELETE payloads carry company_id:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouse_tools;
  ALTER TABLE public.warehouse_tools REPLICA IDENTITY FULL;
  ALTER TABLE public.warehouse_items REPLICA IDENTITY FULL;
  ```
- In `useWarehouseTools.ts`, **add a second realtime channel** for `postgres_changes` on `public.warehouse_tools` (UUID-suffixed channel name to dodge StrictMode re-subscribe). On any change, invalidate `['warehouse-tools']`. This automatically keeps `existingToolKeys` (and thus the candidate de-dup) in sync across tabs — fulfilling project memory `realtime-stock-synchronization`.
- In `ImportFromItemMasterDialog.tsx`, **simplify the existing handler**: invalidate unconditionally on any `warehouse_items` change. The query's own `effectiveCompanyIds` filter handles scope correctly during refetch, and we avoid losing INSERTs whose payload lacks `company_id`.
- Keep the existing manual **Refresh** button (WCAG 2.5.3 user-controllable affordance for assistive contexts).

#### C) Minor accessibility & UX polish

- Add `aria-rowcount={filteredItems.length + 1}` on the `<Table>` and `aria-rowindex` on each row (APG Grid pattern) so screen readers announce position correctly while virtualized.
- Truncate long company names in the "Company (target)" column with `max-w-[180px] truncate` to prevent line-wrap that confuses row alignment at zoom levels.

### Files

**Modified**
- `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx`
  - Replace absolute-positioned virtual rows with sticky padding spacers + visible rows.
  - Add `<colgroup>` with fixed column widths; bump table `min-w` to `1180px`.
  - Simplify realtime handler (drop in-handler company filter).
  - Add ARIA grid attributes.
- `src/hooks/useWarehouseTools.ts`
  - Add second realtime channel subscribing to `postgres_changes` on `warehouse_tools`.

**New migration**
- `supabase/migrations/<timestamp>_realtime_warehouse_tools.sql`:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouse_tools;
  ALTER TABLE public.warehouse_tools REPLICA IDENTITY FULL;
  ALTER TABLE public.warehouse_items REPLICA IDENTITY FULL;
  ```

### Verification

1. Open the dialog with 14k candidates → header and body columns align perfectly; no text overlap; smooth vertical and horizontal scroll on trackpad and touch.
2. Resize the dialog narrower than 1180 px → horizontal scroll appears; columns still aligned; sticky header stays put.
3. Add a new item in Item Master in another tab → candidate row appears within ~1 s without interaction.
4. Create a tool elsewhere (or import a few here) → just-promoted rows disappear from the candidate list within ~1 s and tool count updates without reopening the dialog.
5. Click manual Refresh → spinner shows briefly; list re-fetches.
6. Screen reader (VoiceOver/NVDA): "row 7 of 14,771" announced correctly while scrolling.

