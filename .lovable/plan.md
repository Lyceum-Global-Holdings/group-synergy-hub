# Fix: Bin Allocations Coverage + Company/Location Scoping

## Problem

Two related defects observed on `/warehouse/bin-allocations` and across stock screens:

1. **Coverage gap** — `warehouse_bin_allocations` is written ad-hoc by ~10 client/RPC paths (GRN, transfers, MIN, bulk upload, adjustments, opening stock, project issue/return, tool moves). Today **509 / 3 533 `stock_transactions` rows have `bin_id IS NULL`** (adjustments, opening stock, transfer_in/out, a handful of MIN/GRN/project rows). When the client code fails or is skipped, the ledger and the allocation table drift, so the bin-allocations page does not show every item that has on-hand stock.
2. **Scoping leak** — RLS on `warehouse_bin_allocations` still permits `company_id IS NULL` ("Company users can view bin allocations: USING ((company_id IS NULL) OR can_access_company(company_id))"). Although today 0 rows are NULL, the policy is an open door. The list query also does not filter by the active company/location scope at the DB layer.

## Goal

Every stock-changing operation produces (or updates) exactly one `warehouse_bin_allocations` row and one `stock_transactions` row in the same transaction, both stamped with `company_id`, `location_id`, `bin_id`. The bin-allocations screen and item stock-movement dialogs only show rows the user can access for the currently selected company and location subtree.

## Plan

### 1. Database: single source of truth for bin allocations

- New SECURITY DEFINER RPC `apply_bin_allocation_delta(p_item_id, p_bin_id, p_qty_delta, p_secondary_delta, p_transaction_type, p_reference_type, p_reference_id, p_reference_number, p_notes)`:
  - Resolves `company_id` and `location_id` from the target `warehouse_bins` row (enforces SAP EWM bin parity per the existing `bin-allocation-location-parity` memory).
  - `INSERT ... ON CONFLICT (warehouse_item_id, bin_id) DO UPDATE` to keep one row per (item, bin); blocks the row going negative.
  - Writes the matching `stock_transactions` row with `bin_id`, `location_id`, `company_id`, qty_before/qty_after (relying on the existing immutable-balances trigger).
  - Refreshes `warehouse_items.current_stock` from the sum of allocations for that item.
- Refactor every server-side writer to call this RPC instead of inserting directly:
  - `process_material_issue_stock_update` (both overloads)
  - `transfer_stock_fifo` (transfer_in + transfer_out legs)
  - `tool_adjustment_post_ledger`
  - New helper RPCs for the operations that today only exist client-side: `grn_post_allocation`, `adjust_bin_stock`, `post_opening_stock`, `project_issue_stock`, `project_return_stock`.
- Hard constraints on `warehouse_bin_allocations`:
  - Backfill any nulls, then `ALTER COLUMN company_id SET NOT NULL`, `location_id SET NOT NULL`.
  - Drop the existing `enforce_bin_allocation_location_parity` trigger only after the RPC subsumes it (keeps current memory rules intact).

### 2. Database: backfill the 509 orphan transactions + missing allocations

One-time migration:
- For each `stock_transactions` row with `bin_id IS NULL`, infer the bin from `(item_id, location_id)` when exactly one allocation exists; otherwise insert into a per-location system bin `SYS-LEGACY` and tag `notes` with `[backfill]`.
- For every `warehouse_items` row with `current_stock > 0` but no allocation rows in its location, create a `SYS-LEGACY` allocation so the bin-allocations screen shows it.
- Re-run `current_stock = SUM(allocated_quantity)` per item.

### 3. Database: tighten RLS / scoping

- Drop the `OR company_id IS NULL` branch from all four `warehouse_bin_allocations` policies (SELECT, INSERT, UPDATE, DELETE). Replace with `can_access_company(company_id)` only.
- Mirror the same hardening on `stock_transactions` if any policy still allows NULL company.
- Add composite indexes `(company_id, location_id, warehouse_item_id)` and `(bin_id)` for the list query.

### 4. Reader: location-subtree + company filter at the DB

- New SECURITY INVOKER RPC `list_bin_allocations(p_company_id, p_location_id, p_search, p_limit, p_offset)`:
  - Walks the location subtree (root + sub-locations + departments) the same way `BinAllocationsTab` does today.
  - Returns flat rows joined with item code/name, bin code, location path, on-hand and reserved.
- Switch `useWarehouseBinAllocations` to this RPC; remove the client-side scope walk and the "all companies" fallback (admins still call the RPC with `p_company_id := NULL` and get whatever RLS lets through).

### 5. Frontend cleanup

- Replace every `supabase.from('warehouse_bin_allocations').insert/update/delete` in:
  - `BulkStockUploadDialog.tsx`
  - `useGoodsReceiptNotes.ts`
  - `useStockTransfer.ts`
  - `useMaterialReturns.ts`
  - `BulkInventoryUpdateDialog.tsx`
  - `RelocateBinDialog.tsx`
  - `IssueItemsDialog.tsx`
  with calls to the corresponding RPC. Removes the silent-failure surface area.
- `BinAllocationsTab` already calls `useInvalidateWarehouseStock`; just point it at the new hook output.
- `StockMovementDialog` bin picker keeps the existing subtree fix from the previous fix but now reads from the same RPC for consistency.

### 6. Verification

- After migration: `SELECT COUNT(*) FROM stock_transactions WHERE bin_id IS NULL` → 0.
- `SELECT COUNT(*) FROM warehouse_bin_allocations WHERE company_id IS NULL OR location_id IS NULL` → 0.
- Each item with `current_stock > 0` has ≥ 1 allocation row in the same location.
- From a non-admin session: bin-allocations list and item stock-movement dialog return zero rows for items belonging to companies the user cannot access, even with `company_id IS NULL` rows manually inserted (RLS denies).
- Smoke test each write path (GRN approval, transfer in/out, MIN, MRN, adjustment, opening stock, bulk upload, project issue/return, scanned bin adjustment) and confirm a matching allocation + ledger row appears.

## Out of scope

- No UI redesign of the bin-allocations page.
- No change to bin master / sub-bin hierarchy rules.
- No change to GRN / MIN / transfer business workflows beyond the storage layer.
