# Bulk Issue from Inventory

## Goal
From the Inventory page (`/warehouse/inventory`), let users select multiple stock rows and issue them in one transaction. The action creates **one Material Issue Note (MIN)** with multiple line items, visible in **Material Issue & Return → Material Issues** (2nd screenshot).

## International standard reference
Follows the SAP/WMS "Goods Issue" pattern (movement type 261 — issue to cost center/order):
- One **header document** (MIN) per issue event, with issue date, recipient, department, purpose, reference (job/PR/PO/SRN), location.
- Many **line items** (item, qty, UoM, bin/batch, line purpose).
- Atomic posting: bin allocation deducted, `stock_transactions` ledger written with `qty_before`/`qty_after` from the live allocation (DB trigger), reservation updated if linked.
- Same `MIN-####` numbering already used in the Material Issue module — no parallel numbering scheme.

## UX

1. **Trigger** — extend the existing floating selection bar in `ItemMasterTab.tsx` (already shows "Bulk Update / Change Stock Owner / Bulk Delete" when rows are selected). Add a primary button **"Bulk Issue"**.
2. **Dialog** — new `BulkIssueFromInventoryDialog.tsx`:
   - **Header fields** (single MIN): Issue Date (default today), Issued To, Department, Purpose, Job/PR/PO/SRN (optional), Location (prefilled from `globalLocationId`, read-only if set), Notes.
   - **Lines table** — one row per selected inventory item, prefilled from selection:
     - Item Code · Name · UoM (read-only)
     - **Bin** dropdown: lists bins for that item at the chosen location with available qty; defaults to the bin already shown in the selected row. If only one bin, locked.
     - **Available** (read-only) — `allocated_quantity` of the bin.
     - **Qty to Issue** — numeric, required, must satisfy `0 < qty ≤ available`. Supports `DualQuantityInput` when the item has secondary UoM (matches existing `CreateMaterialIssueDialog`).
     - **Line Purpose** (optional)
     - Remove-line button.
   - Validation summary banner at top listing any over-issue / missing-bin rows; submit disabled until clean.
3. **Submit** — single workflow:
   1. `useMaterialIssues.createMaterialIssueMutation` → inserts `material_issue_notes` (status `issued`), generates `min_number` via existing `generate_min_number` RPC.
   2. `useMaterialIssueItems.createItemsMutation` → bulk inserts all `material_issue_items` for that `min_id`. The existing per-item `onSuccess` already calls `process_material_issue_stock_update` (deducts bin allocation, posts `stock_transactions`, invalidates `warehouse-items`, `warehouse-bin-allocations`, `warehouse-stock-movements`).
   3. Toast "Issued N items on MIN-####" with a link that navigates to `/warehouse/material-issue?tab=issues` and opens `MaterialIssueDetailsDialog` for that MIN.
4. **Permissions** — same gate as `New Issue` in Material Issue & Return (admin or warehouse role); reuse existing checks, no new RBAC.

## Files

**New**
- `src/components/warehouse/BulkIssueFromInventoryDialog.tsx` — the dialog described above. Uses existing primitives: `ItemSelector` not needed (items come from selection), `DualQuantityInput`, `SrnNumberField`, `SrnDocumentUploadField`, `Select`, `Table`. Fetches bin allocations per item via the same query pattern `CreateMaterialIssueDialog` already uses (`warehouse_bin_allocations` filtered by `item_id` + bins at `location_id`).

**Edited**
- `src/components/warehouse/ItemMasterTab.tsx`
  - Add state `isBulkIssueOpen`.
  - Add **"Bulk Issue"** button (primary variant) in the floating action bar at lines 1140-1151, leftmost.
  - Lazy-import and render `BulkIssueFromInventoryDialog`, passing `selectedItems` (already derived at line 362), `defaultLocationId={globalLocationId}`, `onComplete={clearSelection}`.

## Out of scope
- No DB migration. Schema (`material_issue_notes`, `material_issue_items`), the `generate_min_number` RPC, and `process_material_issue_stock_update` RPC already exist and handle ledger + bin deduction correctly.
- No changes to Material Issue & Return page — issues created via this flow appear there automatically (same table, same hook).
- No new approval workflow; issues post directly with `status='issued'` like the existing "New Issue" path. A draft-vs-post toggle can be added later if needed.

## Acceptance
- Selecting ≥1 inventory rows and clicking "Bulk Issue" opens the dialog prefilled with those items at the active location.
- Submitting creates exactly one MIN row visible in Material Issue & Return → Material Issues, with N line items.
- Each line decrements the correct bin allocation and writes a `stock_transactions` row with `transaction_type='material_issue'` and correct `qty_before`/`qty_after` (set by existing trigger).
- Trying to issue more than available is blocked client-side and rejected server-side by the existing RPC.
