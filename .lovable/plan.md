# Per-Location Stock Movement History

## Problem

Same `item_code` legitimately exists as **separate `warehouse_items` rows per (company, location)** — confirmed in DB:

```
INV-ALU-000-0073 | company A | location L1 | id 02c0…  | stock 0
INV-ALU-000-0073 | company B | location ∅  | id b1b5…  | stock 10
```

But several writers (bulk stock upload, adjustment, transfer, GRN posting) historically resolved the inventory row by **item_code alone** or pointed `stock_transactions.item_id` at the *first* match. Result: movements that physically happened at one location/company end up attached to the wrong `warehouse_items.id`, and the Stock Movement History dialog shows a single merged feed for what should be distinct stock keeping units.

The reader (`StockMovementDialog` → `useStockTransactions`) only filters by `item_id`, so it has no way to disambiguate even when the data is correct.

## International Standard Followed

WMS practice (GS1 / SAP IM / Oracle WMS / ISO 9001 traceability):

- The atomic unit of stock is the **Stock Keeping Unit at a Storage Location** — `(Item, Plant/Company, Storage Location, optional Bin/Batch)`.
- Every goods movement document line is timestamped against **exactly one** SKU-at-Location.
- History/ledger queries are always scoped by that tuple — never by item code alone.

We adopt this by making `(item_id, location_id, company_id)` the mandatory scope of every `stock_transactions` row, with `location_id` derived from the source `warehouse_items` row at write time.

## Plan

### 1. Database — add and enforce location scope on the ledger

Migration:

- Add `location_id uuid null` to `stock_transactions` (kept nullable only during backfill).
- Backfill: `update stock_transactions st set location_id = wi.location_id from warehouse_items wi where wi.id = st.item_id and st.location_id is null;`
- Add trigger `stock_transactions_location_guard` (BEFORE INSERT/UPDATE): forces `NEW.location_id := (select location_id from warehouse_items where id = NEW.item_id)` and `NEW.company_id := warehouse_items.company_id`. Prevents drift even if a future caller forgets to set it.
- Index: `(item_id, location_id, created_at desc)` and `(company_id, location_id, item_id, created_at desc)` — supports the new history filter and matches the existing list-RPC pattern.
- Same treatment for `construction_inventory_transactions` (already has `from_location_id`/`to_location_id`; add a `scope_location_id` resolved from the construction inventory row for the per-location feed).

### 2. Writers — resolve inventory row by (catalog_item_id|item_code, company_id, location_id)

Audit and standardise these call sites so they always insert `item_id` belonging to the correct location row:

- `src/components/warehouse/BulkStockUploadDialog.tsx` — already scopes to `effectiveLocationId`; add explicit `location_id` to the `stock_transactions` insert payload (defence in depth before trigger lands).
- `src/components/warehouse/StockAdjustmentDialog.tsx`
- `src/components/warehouse/IssueItemsDialog.tsx`
- `src/components/warehouse/CreateMaterialIssueDialog.tsx` / `CreateMaterialReturnDialog.tsx`
- `src/components/warehouse/CreateGrnDialog.tsx` and the GRN approval/allocation hook
- `src/pages/warehouse/StockTransfer.tsx` (writes a paired `transfer_out` at source location and `transfer_in` at destination — each must carry its own `location_id`)
- `src/components/warehouse/FixMissingOpeningStockDialog.tsx`
- `src/hooks/useStockTransactions.ts` `createTransactionMutation` — extend `CreateStockTransactionData` with required `location_id`.

For any caller that historically searched by `item_code`, switch to: `select id from warehouse_items where item_code=? and company_id=? and location_id is not distinct from ?`.

### 3. Reader — filter history by physical scope

- `useStockTransactions(itemId, locationId?)` — add second arg, push `.eq('location_id', locationId)` when provided, include in query key.
- `StockMovementDialog` — accept and pass `locationId` from the row the user clicked. Show a "Location" column and a header chip indicating the scope (e.g. `Stock Movement History — INV-ALU-000-0073 @ Main Warehouse`).
- `ItemMasterTab.tsx` and `ItemMasterDefinitionTab.tsx` — pass `item.location_id` when opening the dialog.
- `ItemDetailsDialog.tsx` `fetchStockTransactions` — same scope filter.
- `useStockMovementReport.ts` — add a "Location" group/filter so the cross-location report stays correct after backfill.

### 4. Backfill verification utility (admin-only, read-only)

Add a one-off SQL view `v_stock_transactions_location_mismatch` that lists rows where `st.location_id <> wi.location_id` after the trigger lands — surfaces any historical drift the trigger would otherwise silently rewrite. Surface count in the existing Backend → Transactions Monitor panel.

### 5. UI safety net

In `StockMovementDialog` header, when the same `item_code` exists in multiple `(company, location)` combinations, show a small selector ("Viewing: Company A · Main Warehouse — switch") so a user who lands here from a generic place can pick the right SKU-at-Location instead of seeing a merged feed.

## Out of Scope

- No change to `warehouse_items` row identity or to existing bin allocations.
- No retro-splitting of historical transactions whose true source location is unknowable — the trigger only governs new writes; the verification view exposes legacy mismatches for manual review.

## Files Touched (summary)

- New migration: add column, backfill, trigger, indexes, view.
- Edit: `useStockTransactions.ts`, `StockMovementDialog.tsx`, `ItemMasterTab.tsx`, `ItemMasterDefinitionTab.tsx`, `ItemDetailsDialog.tsx`, `useStockMovementReport.ts`, `BulkStockUploadDialog.tsx`, `StockAdjustmentDialog.tsx`, `IssueItemsDialog.tsx`, `CreateMaterialIssueDialog.tsx`, `CreateMaterialReturnDialog.tsx`, `CreateGrnDialog.tsx`, `StockTransfer.tsx`, `FixMissingOpeningStockDialog.tsx`, `types/stockTransaction.ts`.
- Memory: add `mem://architecture/stock-transactions-location-scope` capturing the SKU-at-Location rule.
