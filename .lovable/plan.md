## Goal
Make **Add Piece → Parent Item** load the full Item Master, not only the subset that already has a `warehouse_items` inventory row for the selected company.

## Findings
- Current picker RPC returns `14041` active company inventory rows.
- Item Master has `15016` active catalog rows.
- `972` active catalog items do not yet have a company-scoped `warehouse_items` row, so they are invisible in Add Piece.
- This is a Stage 6b source-of-truth issue: master attributes live in `warehouse_item_catalog`, while `warehouse_items` is now only per-company inventory state.

## Plan
1. **Replace the picker source**
   - Update `list_partial_piece_items` to start from `warehouse_item_catalog`.
   - LEFT JOIN the current company’s `warehouse_items` row when it exists.
   - Return all active catalog items, with `parent_item_id` set to the existing inventory row id when present.
   - Include `catalog_item_id` and a `has_inventory_row` flag so the UI can distinguish provisioned vs not-yet-provisioned items.

2. **Create international-standard parent linkage**
   - Add an RPC like `ensure_partial_piece_parent_item(p_company_id, p_catalog_item_id)`.
   - It will call/use the existing `upsert_warehouse_inventory` pattern to create the per-company `warehouse_items` row only when the user actually selects a catalog item for partial-piece creation.
   - This preserves ERP/WMS separation: Global Item Master stays global; company inventory rows are created on demand for transactions.

3. **Update Add Piece UI flow**
   - Extend `PartialPieceItemPicker` / `usePartialPieceItems` types to support `catalog_item_id` and nullable `parent_item_id`.
   - When a selected catalog item has no `parent_item_id`, call the new ensure RPC, then use the returned `warehouse_items.id` as the actual `parent_item_id` for create/bulk create.
   - Keep existing behavior unchanged for items that already have inventory rows.

4. **Keep list/filter behavior stable**
   - The page-level parent filter can use the same enriched picker list.
   - Existing partial piece listing remains tied to real `warehouse_partial_pieces.parent_item_id`, so only created pieces appear in the table.

5. **Verification**
   - Confirm picker count matches active Item Master count.
   - Select one of the previously missing 972 catalog items and create a partial piece.
   - Confirm a company inventory row is created on demand and the new partial piece appears with catalog code/name.

## Files/areas to change
- Supabase migration for the picker RPC + ensure-parent RPC.
- `src/hooks/warehouse/usePartialPieces.ts`
- `src/components/warehouse/partial-qty/PartialPieceItemPicker.tsx`
- `src/components/warehouse/partial-qty/AddPartialPieceDialog.tsx`
- `src/pages/warehouse/PartialQuantities.tsx` if needed for the filter type.