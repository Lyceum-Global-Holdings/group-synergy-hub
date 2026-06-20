## Goal

Let users pick a destination **Bin per return line** in the MRN Create / Edit Draft dialog, with the bin **pre-filled** from where the stock was originally issued (internal returns) or where it currently lives (supplier returns). Approval then posts the return back into that exact bin, instead of the current "pick any bin allocation, LIMIT 1" fallback.

This matches SAP EWM "Return to Storage Bin" (movement type 653/655) and Oracle WMS RMA put-away — return stock must be addressed at an exact bin, not just an item.

## Behaviour

**Internal return (against a MIN):**
- For each line, look up the bin(s) the stock was issued from via `stock_transactions` where `reference_type='min'`, `reference_id = source_min_id`, `item_id = line.item_id`.
- Default the line's bin to the most recent issuing bin. If the MIN consumed multiple bins, default to the largest-qty one and surface the rest in the picker as "Originally issued from".
- User can override via a bin picker scoped to the MRN's location (`useBinsAtLocation`).

**Supplier return:**
- Default to the line's current `warehouse_bin_allocations` row for that (item, company, location). If multiple, prefer the one with the largest on-hand qty.
- User can override via the same bin picker.

**Validation:**
- Bin is **required** before "Save as Draft" can submit lines with `qty_to_return > 0`.
- Selected bin must belong to the MRN's location (existing `useBinsAtLocation` already enforces exact-node lookup — no ancestor inheritance, per project rule).
- Edit-Draft flow re-hydrates the saved `bin_id` per line.

**Approval:**
- `approve_material_return` uses `line.bin_id` to resolve the exact `warehouse_bin_allocations` row (creating one via existing upsert if none exists yet for that bin), and passes it into `process_material_return_stock_update`. The current LIMIT-1 fallback is removed and becomes an error if `bin_id` is null on any non-zero line.

## Technical changes

### Database (one migration)
1. `ALTER TABLE public.material_return_items ADD COLUMN bin_id uuid REFERENCES public.warehouse_bins(id);` (nullable for back-compat with existing rows).
2. New helper RPC `get_min_issued_bins(p_min_id uuid, p_item_id uuid)` → returns `[{bin_id, bin_code, location_id, quantity}]` aggregated from `stock_transactions` where `reference_type='min' AND reference_id=p_min_id AND item_id=p_item_id AND quantity_change < 0`. SECURITY DEFINER, `can_access_company` gate, GRANT EXECUTE to authenticated.
3. Replace `approve_material_return`:
   - Resolve `v_bin_allocation_id` from `v_item.bin_id` (find-or-create allocation row via existing pattern for that bin + item + company).
   - Reject approval if any line has `quantity_returned > 0 AND bin_id IS NULL` (ISO 9001 §8.5.4 traceability).
4. Extend `get_material_return_items` to return `bin_id` and `bin_code`.

### Frontend
- **`src/hooks/warehouse/useMinIssuedBins.ts`** (new) — React Query hook wrapping the new RPC, keyed by (min_id, item_id).
- **`CreateMaterialReturnDialog.tsx`**:
  - Add a **Bin** column to the Return Items table between "Qty to Return" and "Condition".
  - Internal flow: when a MIN + line is loaded, call `useMinIssuedBins` and prefill `line.bin_id` with the top bin; remember user overrides.
  - Supplier flow: prefill from existing `warehouse_bin_allocations` for that item.
  - Bin picker uses `useBinsAtLocation(mrn.location_id)`; show "Originally issued from {bin_code}" hint under the picker when default came from MIN history.
  - Save path includes `bin_id` in `CreateMaterialReturnItemData` / update payload.
- **`MaterialReturnDetailsDialog.tsx`** — show the per-line bin under the item name.
- **`src/types/materialIssueReturn.ts`** — add `bin_id?: string | null` to `MaterialReturnItem` and `CreateMaterialReturnItemData`.

### Caching
After approval / draft save, invalidate via existing `useInvalidateWarehouseStock` (already wired) so bin allocations refresh.

## Out of scope
- MIN/GRN bin selection — GRN already has its own approve-time bin allocation dialog; MIN consumes bins via FIFO at approval. Both stay unchanged unless you ask separately.
- Splitting one return line across multiple bins. If users need that we'd add a "split line" affordance — happy to layer it in a follow-up.

## Acceptance
- New MRN draft against a MIN auto-fills the bin each line was issued from; the user can change it; saving persists `bin_id` per line.
- Editing a draft re-hydrates the saved bin.
- Approval posts the return into the chosen bin (verifiable in Bin Allocations + Stock Ledger).
- Approval is blocked with a clear error if any returnable line has no bin selected.
