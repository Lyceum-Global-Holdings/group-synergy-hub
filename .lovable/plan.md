## Problem

Today, picking an item in **CreateGrnDialog** or the auto-resolve loop in **GrnBinAllocationDialog** calls `ensure_warehouse_item_for_company` immediately. That provisions a `warehouse_items` row for the company **before** the GRN is approved — so the item shows up in `/warehouse/inventory` (with zero stock, no bin) as soon as a draft GRN is being typed. Approval and bin-allocation are also two separate client-side writes; nothing at the DB level guarantees an approved GRN has been fully put away.

## Standard

Adopt the **GR Blocked Stock / Quarantine on Receipt** pattern (ISO 9001:2015 §8.6 "Release of products and services", §8.5.4 "Preservation / identification & traceability", SAP MIGO blocked-stock movement type, GS1 CBV `inProgress → active`):

> Goods received are **non-inventory** until (a) a competent person approves the GRN and (b) the full received quantity is allocated to physical bins, in a single atomic transaction.

## Changes

### 1. New SECURITY DEFINER RPC — `approve_grn_with_allocations(p_grn_id uuid, p_allocations jsonb)`
One transaction performs everything; the existing approval trigger and stock-ledger trigger stay untouched.

- Lock GRN row `FOR UPDATE`; assert `status = 'submitted'` and caller `is_admin()` (existing helper).
- Set GUC `perform set_config('app.grn_allocating','1', true);` so the guard trigger (#3) allows the status flip.
- For each `grn_items` row:
  - If `warehouse_item_id IS NULL` but `catalog_item_id` / `item_code` resolves, call `ensure_warehouse_item_for_company(company_id, catalog_item_id)` and persist the resulting id back to `grn_items.warehouse_item_id` — **this is the only path that provisions inventory rows.**
  - Validate `Σ allocation.quantity = quantity_received` per line; reject otherwise with `RAISE EXCEPTION 'GRN line % under/over-allocated'`.
- Upsert each allocation into `warehouse_bin_allocations` (scoped per company + bin + location, mirroring current logic; secondary qty prorated).
- Insert one `stock_transactions` row per line (`transaction_type='goods_receipt'`, `reference_type='grn'`). Existing trigger keeps `qty_before/after` correct.
- `UPDATE goods_receipt_notes SET status='approved', approved_by=auth.uid(), approved_date=now() WHERE id=p_grn_id;`
- Returns the GRN id + count of allocations.

### 2. Guard trigger — `enforce_grn_allocation_on_approval`
`BEFORE UPDATE ON public.goods_receipt_notes`. If `NEW.status='approved' AND OLD.status<>'approved'` and `current_setting('app.grn_allocating', true) IS DISTINCT FROM '1'` → `RAISE EXCEPTION 'GRN approval must go through approve_grn_with_allocations (ISO 9001 §8.6)'`. This blocks every other code path (PostgREST, ad-hoc SQL, future bugs).

### 3. Stop pre-provisioning inventory from the UI
- `CreateGrnDialog.tsx`: when picking from the item-master combobox, **do not** call `ensure_warehouse_item_for_company`. Store only `catalog_item_id`, `item_code`, `item_name`, tracking flags. Add a new optional column `grn_items.catalog_item_id uuid REFERENCES warehouse_item_catalog(id)` (nullable; needed because today only `warehouse_item_id` is captured and that resolves to a per-company row that we now refuse to create early).
- `GrnBinAllocationDialog.tsx`: the open-time auto-resolve loop and the manual picker continue to **lookup** existing `warehouse_items` for the company, but **never create new ones**. If none exists, the row stays unresolved and shows a clear hint "Will be provisioned on approval" — the actual creation happens inside the RPC.

### 4. Rewire `useApproveGoodsReceiptNote`
Replace the 5-step client flow (item link → status update → stock_transactions insert → bin allocation upserts) with one `supabase.rpc('approve_grn_with_allocations', { p_grn_id, p_allocations })` call. The rejection mutation is unchanged.

### 5. Inventory list excludes empty placeholders (defence in depth)
`list_warehouse_inventory` already paginates `warehouse_items`. Add an optional filter `include_zero_unallocated boolean default true` that defaults to current behaviour (no regression) but lets `/warehouse/inventory` opt-in to hiding rows where `current_stock = 0 AND NOT EXISTS (warehouse_bin_allocations…)`. UI calls it with the flag on.

### 6. Memory
Update `mem://features/warehouse/grn-approval-allocation-workflow` to record the new invariant: "Inventory rows + bin allocations are created **only** inside `approve_grn_with_allocations`; the guard trigger blocks any other approval path."

## Out of scope

- Quality-hold workflow (separate `quality_status='rejected'` line handling) — already covered by the rejection flow.
- Partial / multi-stage putaway (SAP "GR-then-Putaway"): current design requires full allocation at approval. Splitting receipt vs putaway is a larger module change and can be a future enhancement.
- Tools / asset master receiving paths.

## Migration safety

- Existing approved GRNs are unaffected (trigger only fires on transition into `approved`).
- Existing submitted GRNs with pre-provisioned `warehouse_items` rows still approve cleanly via the RPC — `ensure_warehouse_item_for_company` is idempotent.
- The new `catalog_item_id` column is nullable; back-fill is optional.
