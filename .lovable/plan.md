

## Phase 3 — Shared `<VirtualTable>` rollout

Phase 2 is live (realtime bus, debounced invalidations, narrow selects). The next bottleneck is the DOM cost of the largest tables: **Item Master (~14k rows), Asset Master (10k+), Tool Management, GRN list, MDP**. Currently they render every row, so even with smaller payloads the browser stalls on initial paint and slows down on scroll. Phase 3 standardizes a single virtualized table component and applies it across these screens.

### Outcome

- Tables of any size render in <100 ms (only ~30 rows in DOM at a time).
- Smooth 60 fps scrolling on Item Master, Asset Master, Tool Management, GRN list, MDP results table.
- One shared, accessible (`role="grid"` + ARIA) virtualization wrapper — consistent UX, easier future maintenance.
- No behavioural change: column layout, sorting, row click, selection checkbox, action buttons all preserved.

### Standards applied

- **WAI-ARIA Authoring Practices — Grid pattern**: `role="grid"`, `role="row"`, `aria-rowcount`, `aria-rowindex` so screen readers announce "row N of total" while only ~30 rows are in DOM.
- **TanStack Virtual best practice**: dynamic row measurement (`measureElement`), `overscan: 8`, sticky `<thead>` outside the scroll container so columns stay aligned.
- **React performance**: row component wrapped in `React.memo` to avoid re-render on parent state changes.
- **Project memory `shared-foundational-components`**: live in `src/components/shared/`.

### Component API

`src/components/shared/VirtualTable.tsx` (new)

```tsx
<VirtualTable
  columns={columns}                  // existing DataTableColumn<T>[] shape, reused
  data={rows}                        // T[]
  isLoading={isLoading}
  estimatedRowHeight={48}
  overscan={8}
  virtualizeFromRowCount={200}       // below this, render normally (no virtualization overhead)
  getRowId={(row) => row.id}
  onRowClick={...}
  rowClassName={...}
  emptyMessage="No data found."
  stickyHeader                       // default true
  ariaLabel="Item master table"
/>
```

- Below `virtualizeFromRowCount`, falls back to plain `<DataTable>` rendering — small lists pay zero virtualization cost.
- Above the threshold, renders header + a virtualized `<div role="rowgroup">` body using `useVirtualizer` (proven in `ImportFromItemMasterDialog`).
- Reuses the existing `DataTableColumn<T>` interface so migration is mostly a one-line component swap when columns are already declarative.

### Migration matrix

| Screen | Current pattern | Migration approach |
|---|---|---|
| **Item Master** (`ItemMasterTab.tsx`, 1,049 lines, ~14k rows) | Inline `<Table>` with imperative `<TableRow>` map (lines 623–879), heavy per-row JSX (checkbox, status badges, action menu) | Extract row JSX into a `<ItemRow>` memoized component; swap `<TableBody>` for `<VirtualTable>` keeping the same column descriptors. Preserve: row selection, bulk action bar, sorting, filters. |
| **Asset Master** (`AssetManagement.tsx`, 1,347 lines, 10k+ rows) | Inline `<Table>` map (lines 1100–1191) | Same approach: extract `<AssetRow>` memo + swap to `<VirtualTable>`. |
| **Tool Management** main grid (`ToolManagement.tsx`) | Already smaller; only virtualize if row count >200 (auto via threshold). | Drop-in `<VirtualTable>`; threshold takes care of small lists. |
| **GRN list** (`GoodsReceiptNote.tsx`, 240 lines) | Inline `<Table>` map (lines 175–219) | Drop-in swap; usually small lists so threshold keeps it un-virtualized — still benefits from consistent ARIA. |
| **MDP results** (`MaterialDemandPlanning.tsx`, lines 750–860) | Inline map of `calculationResult` | Swap result table only (other small dialogs unchanged). |

### Files

**New**
- `src/components/shared/VirtualTable.tsx` — the shared component.
- `src/components/shared/VirtualTable.types.ts` — re-exports `DataTableColumn<T>` for one-import ergonomics.

**Modified**
- `src/components/warehouse/ItemMasterTab.tsx` — extract `ItemRow` memo + swap body to `<VirtualTable>`.
- `src/pages/warehouse/AssetManagement.tsx` — extract `AssetRow` memo + swap body to `<VirtualTable>`.
- `src/pages/warehouse/ToolManagement.tsx` — replace main grid with `<VirtualTable>`.
- `src/pages/warehouse/GoodsReceiptNote.tsx` — replace `<Table>` block with `<VirtualTable>`.
- `src/pages/procurement/MaterialDemandPlanning.tsx` — only the `calculationResult` results table.

**Memory**
- New: `mem://architecture/virtual-table-pattern` — "Lists ≥200 rows must use `<VirtualTable>` from `src/components/shared/`. Never roll a custom virtualizer in feature code."
- Update Core line in `mem://index.md` referencing the standard.

### Out of scope (later phases)

- Phase 4: DB indexes + materialized RPCs for >5k-row lists.
- Phase 5: `web-vitals` reporter + Lighthouse CI budget.
- Sortable column headers inside `<VirtualTable>` (the wrapper passes through; existing per-page sort UI stays).

### Verification

1. Item Master with ≥10k items: initial paint <500 ms, DOM contains <50 `<tr>` elements while idle, scrolling stays at 60 fps (DevTools Performance).
2. Asset Master: same — no jank on bulk row select/scroll.
3. Tool Management & GRN list (smaller datasets): visually unchanged, no regression.
4. Screen reader (VoiceOver/NVDA) announces "row 47 of 14,771" while scrolling through Item Master.
5. Sticky header stays aligned with body columns at all scroll positions and at the 1870px viewport.
6. Row selection checkboxes, action menus, click-to-open behaviour all still work on virtualized rows.
7. No console warnings (ARIA, key duplication, ref forwarding).

