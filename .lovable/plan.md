## Root cause

Two bugs are conflating into "stock isn't reducing":

1. **`process_material_issue_stock_update` SQL function silently fails** because it tries to `UPDATE warehouse_bin_allocations SET available_quantity = ...`. `available_quantity` is a **generated column** in this project — Postgres rejects the write. The JS `useMaterialIssueItems` hook catches the error and only shows a toast, so the MIN appears created but stock never moves. (Confirmed against most recent MIN: 0 rows in `warehouse_stock_movements`.)

2. **No location scoping on issue.** The RPC (and `IssueItemsDialog`) deducts from *any* bin allocation belonging to the item — even bins in a different warehouse/location than the MIN's `location_id`. Per international stores standard (SAP MM: a Goods Issue 261/201 movement must originate from the storage location chosen on the document header), stock at Location A must never be consumed by an issue raised against Location B.

Additionally `material_issue_notes.company_id` is being saved as NULL on creation (recent rows), which breaks downstream company-scoped logic.

## Fix

### A. SQL migration — rewrite `process_material_issue_stock_update`

New signature:

```
process_material_issue_stock_update(
  p_item_id uuid,
  p_quantity_issued numeric,
  p_location_id uuid,        -- NEW: required, from MIN header
  p_bin_allocation_id uuid DEFAULT NULL,
  p_min_id uuid DEFAULT NULL,
  p_min_number text DEFAULT NULL
)
```

Behaviour:
- Validate `p_location_id IS NOT NULL`.
- Compute available stock as `SUM(allocated_quantity - reserved_quantity)` over bin allocations whose bin's `location_id = p_location_id`. (Join `warehouse_bin_allocations` → `warehouse_bins`.)
- If the explicit `p_bin_allocation_id` is provided, verify its bin sits in `p_location_id`; otherwise raise.
- If not provided, pick bins **at that location only**, FIFO by `created_at` (oldest first — international FEFO/FIFO default), and consume across multiple bins if needed.
- For each bin consumed: write a `warehouse_stock_movements` row (`movement_type='issue'`, reference_type='material_issue') and **UPDATE only `allocated_quantity`, `reserved_quantity`, `updated_at`** — never `available_quantity` (generated).
- Reduce `warehouse_items.reserved_quantity` once at the end. Do NOT directly write `warehouse_items.current_stock` — rely on existing `trg_sync_item_stock_after_bin_allocation` trigger.
- If item has zero bin allocations at the location, raise `Insufficient stock at selected location` (no silent fallback to global stock — that's the bug we're fixing).
- Wrap in `FOR UPDATE` row locks on the bin allocations to prevent concurrent over-issue.

### B. Update callers to pass location

- `src/hooks/useMaterialIssueItems.ts`: read MIN's `location_id` (already fetches `min_number`); throw if null; pass `p_location_id` to RPC.
- `src/components/warehouse/IssueItemsDialog.tsx`: rewrite "manual" stock-deduction loop. Replace the inline `warehouse_items.update(current_stock - …)` and bin-allocation loop with a single call to the corrected `process_material_issue_stock_update` RPC per line item, passing the MIN's `location_id`. Pre-flight stock check also queries per-location bin sum, not `warehouse_items.current_stock`.

### C. Enforce location on creation

- `src/components/warehouse/CreateMaterialIssueDialog.tsx`:
  - Make the "Issue Location" field **required** (cannot submit without it).
  - Once a location is picked, filter the `ItemSelector` list to items that have at least one bin allocation at that location (pass a `locationId` prop to `ItemSelector`).
  - Show "Available at this location: X" instead of the global `current_stock` in the item row, computed from bin allocations at the chosen location.
  - Save `company_id: selectedCompany.id` on the MIN insert (currently missing → NULLs in DB).

### D. ItemSelector enhancement

- Add optional `locationId?: string` prop. When set, fetch a per-item availability map (`SUM(allocated_quantity)` grouped by `warehouse_item_id` filtered by `bin.location_id = locationId`) and:
  - Hide items with zero availability at that location.
  - Display `Stock @ location: N` instead of the global `current_stock`.

## Files

- New migration: `add_location_scope_to_material_issue_stock_update.sql` (drops + recreates RPC)
- `src/hooks/useMaterialIssueItems.ts`
- `src/components/warehouse/IssueItemsDialog.tsx`
- `src/components/warehouse/CreateMaterialIssueDialog.tsx`
- `src/components/common/ItemSelector.tsx`

## Standards alignment

- SAP MM Goods Issue (movement type 201/261): always tied to a single Plant + Storage Location.
- ISO 9001 / GS1 stores: traceable per-location stock movement; no cross-location consumption.
- FIFO bin selection within a location matches WMS best practice.