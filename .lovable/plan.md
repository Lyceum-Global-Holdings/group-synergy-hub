## Problem

"Bulk add failed — column `item_code` of relation `warehouse_items` does not exist."

After Stage 6b dropped the mirrored `item_code` and `name` columns from `warehouse_items` (catalog is now the sole source of truth), the `upsert_warehouse_inventory` RPC was not updated. It still INSERTs placeholder values into those dropped columns:

```sql
INSERT INTO public.warehouse_items (
  ..., item_code, name
) VALUES (
  ..., '__pending__', '__pending__'
)
```

This function is called by `ensure_partial_piece_parent_item` whenever a partial-piece is added for a catalog item that has no per-company `warehouse_items` row yet — which is exactly the bulk-add path the user hit.

## Fix

Single database migration to update `upsert_warehouse_inventory`: remove `item_code` and `name` from both the INSERT column list and the VALUES list. Everything else (ON CONFLICT, returning id, signature) stays identical.

No frontend or hook changes are needed — `usePartialPieces`, `AddPartialPieceDialog`, and `ensurePartialPieceParentItem` already operate purely on `catalog_item_id`.

## Verification

1. Open Partial Quantities → Add Partial Piece, pick a catalog item that has never been used by the current company, fill bulk rows, submit → expect success toast and rows visible in the list.
2. Re-run for an item that already has a `warehouse_items` row → ON CONFLICT path still updates without touching dropped columns.
3. Confirm no other callers regress: `upsert_warehouse_inventory` is also used by the inventory create flow and any code in `flattenWarehouseItem` consumers — both already read from the catalog view, so they are unaffected.
