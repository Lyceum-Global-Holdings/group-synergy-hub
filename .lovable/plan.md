

## Fix Import-from-Item-Master: scrollable table + auto-refresh

### Outcome

The candidate table inside `ImportFromItemMasterDialog` scrolls smoothly through all 14,000+ rows, and the dataset stays fresh — automatically reflecting new Item Master entries and disappearing rows once they are promoted to Tool Master.

### Standards applied

- **WCAG 2.2 SC 1.4.10 (Reflow) & SC 2.5.7 (Dragging Movements)** — content must be scrollable without loss of information; touch and pointer scrolling must work in both axes.
- **WAI-ARIA APG "Grid" pattern** — large tabular datasets should be virtualized to keep keyboard / screen-reader navigation responsive.
- **SAP Fiori "Responsive Table" guideline** — tables in dialogs use a fixed-height scrollable viewport with sticky header.
- **Project memory `realtime-stock-synchronization`** — list views backed by `warehouse_items` must subscribe to Postgres changes and invalidate React Query caches.
- **Project memory `react-query-global-cache-freshness-permanent`** — `staleTime: 0` plus explicit invalidation on related mutations.

### Root causes

1. **Scroll fails / feels stuck**
   - `ScrollArea className="flex-1"` works only when the parent flex chain actually constrains its height. The dialog uses `max-h-[90vh] flex flex-col`, but the *banners block* (3 alerts + scope controls + search) consumes most of the height, leaving the `ScrollArea` with `min-content` height — Radix then renders the table at full natural height and the page scrolls instead of the table.
   - Rendering ~15,000 rows un-virtualized chokes the main thread; even when scroll works, it stutters and feels broken.

2. **Data not refreshing**
   - No Supabase realtime subscription on `warehouse_items` for this query.
   - After a successful import, only `warehouse-tools` is invalidated by `useWarehouseTools.createBulkTools` — the candidate query (`warehouse-items-tool-candidates`) is never invalidated, so promoted rows linger until the dialog is reopened (which `removeQueries` only does on close).
   - No manual refresh affordance.

### Changes

#### 1) Layout: guarantee a constrained scroll viewport

- Wrap the alerts block in a single `div` with `shrink-0` so the flex column lets the `ScrollArea` fill remaining space.
- Replace `ScrollArea className="flex-1 border rounded-md"` with an explicit, bounded container:
  ```tsx
  <div className="flex-1 min-h-[300px] border rounded-md overflow-hidden">
    <div className="h-full w-full overflow-auto">
      <Table>…</Table>
    </div>
  </div>
  ```
  Using a native scroll container avoids Radix `ScrollArea` height-collapse pitfalls and gives proper horizontal + vertical scrolling on touch and trackpad devices (WCAG 2.5.7).
- Add `min-w-[1000px]` on `<Table>` so columns don't crush on narrow viewports — horizontal scroll kicks in instead.
- Keep `sticky top-0` header inside the new scroll container.

#### 2) Performance: virtualize rows over ~200

- Use `@tanstack/react-virtual` (already used elsewhere in the project — confirm and reuse) to virtualize `<TableBody>` when `filteredItems.length > 200`. Below that threshold, render normally to keep the simpler DOM.
- Row height fixed at ~52 px with `overscan: 8`.
- Maintains keyboard navigation per ARIA grid pattern.

#### 3) Data freshness

- **Realtime subscription**: add a `useEffect` inside the dialog (active only when `open === true`) that subscribes to `postgres_changes` on `public.warehouse_items` filtered to `effectiveCompanyIds`. On INSERT/UPDATE/DELETE, call `queryClient.invalidateQueries({ queryKey: ['warehouse-items-tool-candidates'] })`. Channel name uses `crypto.randomUUID()` to avoid the StrictMode re-subscribe error already encountered in tools hooks.
- **Post-import invalidation**: in `handleImport`'s `onSuccess`, also invalidate `['warehouse-items-tool-candidates']` and `['warehouse-tools']` so the next time the dialog reopens (or stays open for chained imports), the just-promoted items are removed and tool keys updated. Currently it just closes; chaining imports without closing leaves stale rows.
- **Existing-tool keys realtime**: `useWarehouseTools` already subscribes to `warehouse_tools` changes — `existingToolKeys` recomputes automatically. Keep as-is.
- **Manual refresh button**: add a small `RefreshCw` icon button next to the "candidates" badge that calls `queryClient.invalidateQueries({ queryKey: ['warehouse-items-tool-candidates'] })`. Spinner while `isFetching`.
- Confirm `warehouse_items` is in the `supabase_realtime` publication; if not, add it via migration:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouse_items;
  ```

### Files

**Modified**
- `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx`
  - Replace `ScrollArea` with bounded native scroll container; add `min-w-[1000px]` on Table.
  - Add `shrink-0` wrapper around alerts/scope block.
  - Add `useEffect` realtime subscription on `warehouse_items` with unique channel name.
  - Invalidate candidate query in `handleImport` `onSuccess`.
  - Add manual refresh button bound to `isFetching`.
  - Virtualize rows when `filteredItems.length > 200` via `@tanstack/react-virtual`.

**New migration (only if publication check shows it's missing)**
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouse_items;` plus `ALTER TABLE public.warehouse_items REPLICA IDENTITY FULL;` for accurate change payloads.

### Verification

1. Open the dialog → table scrolls vertically and horizontally on trackpad, mouse wheel, and touch; sticky header stays put.
2. With 14,000+ candidates → scroll feels smooth (virtualized); CPU stays under control.
3. Add a new item in Item Master in another tab → candidate list updates within ~1 s (realtime).
4. Select a few rows → click Import → after success, reopen dialog: imported rows are gone without manual reload.
5. Click the refresh button → spinner shows briefly; list re-fetches.
6. Resize viewport down to 1024 px wide → horizontal scroll appears, no column crushing; banners remain visible above the table.
7. Keyboard: Tab through rows, Space toggles select; row navigation remains responsive even at 14k rows.

