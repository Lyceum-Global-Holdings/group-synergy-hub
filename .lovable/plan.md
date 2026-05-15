## Partial Quantity Manager (Warehouse submodule)

A new warehouse submodule that surfaces every **open partial quantity** for every item — one row per `(item, location, bin, batch)` — in a fast, Excel-like grid, with a per-row **Issue** action that posts a properly scoped stock movement.

This is the SAP EWM / Oracle WMS / Manhattan WMS pattern: the atomic unit of stock is the bin/batch holding, not the item total. An item code with 3 open holdings = 3 rows.

### Where it lives

- Route: `/warehouse/partial-quantities`
- File: `src/pages/warehouse/PartialQuantities.tsx`
- Registered in `src/constants/moduleConfig.ts` under `warehouse.subModules` as `{ key: 'partial-quantities', name: 'Partial Quantities', description: 'Excel-style view of open bin/batch holdings with per-row issue' }`
- Wired into `src/App.tsx` lazy routes alongside other warehouse pages.

### Data source (no schema change)

The "partial quantities" view is a **read projection** over existing tables — no new domain entities needed:

- `warehouse_bin_allocations` → one row per open holding (allocated_quantity > 0)
- `warehouse_batches` → batch_id, batch_no, expiry, received_at (for FIFO ordering)
- `warehouse_items` → item_code, description, base_uom, secondary_uom, track_secondary_quantity
- `warehouse_locations`, `warehouse_bins` → location/bin display
- Respects existing RLS (company-scoped) and the global location filter from `LocationFilterContext`.

A new `SECURITY INVOKER` RPC `list_partial_quantities(p_company_id, p_location_id, p_search, p_limit, p_offset, p_cursor)` returns the flat denormalized rows in keyset-paginated form (per `list-rpc-pattern` + `keyset-pagination-uniqueness` memory rules). Cursor: `(received_at DESC, allocation_id)`.

Returned columns per row:

```text
item_id, item_code, item_name, base_uom,
secondary_uom, track_secondary_quantity, secondary_quantity,
location_id, location_name,
bin_id, bin_code,
batch_id, batch_no, expiry_date, received_at,
allocated_quantity, reserved_quantity, available_quantity,
unit_cost, total_value
```

### UI: Excel-style grid

Built on the existing `src/components/shared/VirtualTable.tsx` (per `virtual-table-pattern` memory — required for ≥200 rows). Layout:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [Search item code/name]  [Location filter]  [Batch only ☐] [Export CSV] │
├──────────┬─────────┬──────┬──────┬───────┬──────────┬────────┬─────────┤
│ Item Code│ Name    │ Loc  │ Bin  │ Batch │ Available│ Sec Qty│ Action  │
├──────────┼─────────┼──────┼──────┼───────┼──────────┼────────┼─────────┤
│ ITM-001  │ Bolt M8 │ WH-A │ A-01 │ B0091 │   42.000 │ 12 pcs │ [Issue] │
│ ITM-001  │ Bolt M8 │ WH-A │ A-02 │ B0103 │   18.500 │  5 pcs │ [Issue] │
│ ITM-001  │ Bolt M8 │ WH-B │ B-11 │ —     │    7.000 │   —    │ [Issue] │
│ ITM-002  │ Cable…  │ WH-A │ C-04 │ B0205 │  120.000 │   —    │ [Issue] │
└──────────┴─────────┴──────┴──────┴───────┴──────────┴────────┴─────────┘
```

Row is highlighted in FIFO order per item: oldest `received_at` carries an "Issue First (FIFO)" pill (per `warehouse-batch-fifo-logic` memory).

Editable cells: none. Issuing through a controlled dialog is safer than inline edits and matches the existing MIR audit trail. (Inline-edit "Excel feel" preserved via fixed-row heights, sticky header, frozen first 2 columns, keyboard nav, copy-to-clipboard, CSV export.)

### Per-row Issue action

Clicking **Issue** opens `IssuePartialQuantityDialog`:

- Pre-fills item, location, bin, batch (locked — never silently merge bins, per `stock-transactions-location-scope` memory).
- Inputs: `quantity_to_issue` (≤ available), optional `secondary_quantity_to_issue` if `track_secondary_quantity`, `purpose` (cost center / project / construction site / free text), `reason_code` (GS1 CBV-aligned: `CONSUMPTION`, `INTERNAL_TRANSFER`, `SAMPLE`, `WASTE`, `RETURN_TO_VENDOR`), `reference_no`, `notes`.
- On submit, calls a new edge-style RPC `issue_partial_quantity(p_allocation_id, p_quantity, p_secondary_quantity, p_reason_code, p_reference, p_notes)` which:
  1. Re-validates available qty under row lock (`SELECT … FOR UPDATE`).
  2. Decrements `warehouse_bin_allocations.allocated_quantity` for the exact bin/batch.
  3. Decrements `warehouse_batches.quantity_remaining` if batch-tracked.
  4. Inserts a `stock_transactions` row with `type='ISSUE'`, `bin_id`, `batch_id`, `reason_code`, `reference_no`. The DB trigger `set_stock_transaction_balances` stamps `quantity_before/after` from the live bin allocation (per `stock-ledger-immutable-balances` memory) — never set client-side.
  5. Returns the new transaction id + remaining qty.
- React Query invalidates `partial-quantities`, `warehouse-inventory`, `bin-allocations`, `stock-ledger`.
- Toast with link to the resulting movement.

Bulk Issue (phase 1 stretch, low risk): multi-select rows → "Issue Selected" creates one MIR header (`material_issues`) with N lines, one per selected row, then posts each line through the same RPC. Reuses the existing `material_issues` schema so it shows up in MIR history.

### International standards alignment

- **GS1 CBV reason codes** for movement disposition (same set already used in `scanned-bin-adjustment`).
- **WMS atomic SKU = (item, location, bin, batch)** — SAP EWM / Oracle WMS / Manhattan WMS convention.
- **FIFO by `received_at`** — IFRS-aligned cost flow; matches `warehouse-batch-fifo-logic` memory.
- **Immutable ledger**: `stock_transactions` write-once; balances stamped by trigger; full audit (`created_by`, `reason_code`, `reference_no`).
- **ISO 8601** timestamps; quantities at item's `base_uom` precision; secondary qty optional per `dual-quantity-tracking` memory.
- **RLS company isolation** preserved end-to-end (per Core memory).

### Permissions

- Read: anyone with `warehouse.view`.
- Issue: `warehouse.material_issue.create` (existing MIR permission). Reuses RBAC, no new role.
- Respects per-location grants (per `hierarchical-location-permissions` memory).

### Performance

- `list_partial_quantities` RPC + composite index `(company_id, item_id, received_at DESC, id)` on `warehouse_bin_allocations` (partial: `WHERE allocated_quantity > 0`).
- Server-side pagination (200 rows/page), keyset cursor.
- VirtualTable with row virtualization; React Query `staleTime: 0` on this hook (live stock surface, per Core memory).
- Realtime subscription via `useRealtimeChannel` on `warehouse_bin_allocations` + `stock_transactions` for the active company/location, debounced invalidation (per `realtime-bus-pattern` memory).

### Out of scope (phase 1)

- True inline-edit of allocations (would bypass the ledger). Deferred — adjustments must continue to flow through Stock Adjustment / Cycle Count.
- Receipts / putaway from this screen (use GRN / Putaway).
- Cross-company moves (use Stock Transfer).

### Files to add / change

```text
src/pages/warehouse/PartialQuantities.tsx                 (new)
src/components/warehouse/partial-qty/PartialQtyGrid.tsx   (new, VirtualTable wrapper)
src/components/warehouse/partial-qty/IssuePartialQuantityDialog.tsx (new)
src/components/warehouse/partial-qty/columns.tsx          (new)
src/hooks/warehouse/usePartialQuantities.ts               (new, RQ + realtime)
src/hooks/warehouse/useIssuePartialQuantity.ts            (new mutation)
src/constants/moduleConfig.ts                             (add submodule)
src/App.tsx                                               (lazy route)
supabase/migrations/<ts>_partial_quantities.sql           (RPCs + index, no schema change)
```

### Migration (SQL summary)

- `CREATE INDEX warehouse_bin_allocations_open_idx ON warehouse_bin_allocations (company_id, item_id, received_at DESC NULLS LAST, id) WHERE allocated_quantity > 0;` (joined to batch for received_at)
- `CREATE OR REPLACE FUNCTION list_partial_quantities(...)` — SECURITY INVOKER, returns `SETOF record`.
- `CREATE OR REPLACE FUNCTION issue_partial_quantity(...)` — SECURITY INVOKER, atomic with row lock.
- No table or column added.
