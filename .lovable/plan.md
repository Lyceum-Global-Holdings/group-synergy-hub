## Problem

On `/warehouse/partial-quantities`, "Add Partial Piece" shows "No active items found." The item-master picker is empty because Stage 6b dropped `item_code` and `name` from `warehouse_items` (they now live only on `warehouse_item_catalog`), but four Partial-Pieces RPCs still read those columns from `warehouse_items` and silently fail / return zero rows.

Affected RPCs:

| RPC | Broken reference |
|---|---|
| `list_partial_piece_items` | `i.item_code`, `i.name` from `warehouse_items` |
| `list_partial_pieces` | `i.item_code`, `i.name`, search predicates on both |
| `next_partial_piece_code_for_item` | `SELECT item_code FROM warehouse_items` |
| `import_partial_pieces` | `lower(item_code)` lookup on `warehouse_items` |

`create_partial_piece` and the propagation trigger only read columns that still exist (`base_uom`, `secondary_uom`, `unit_cost`) — no change needed.

## Fix (single migration)

Rewrite each RPC above to join `warehouse_item_catalog c ON c.id = i.catalog_item_id` and source `item_code` / `name` from `c`. Keep all per-company columns (`base_uom`, `secondary_uom`, `unit_cost`, `track_secondary_quantity`, `status`) on `warehouse_items`. This matches the Stage 6 contract: catalog is the source of truth for master attributes, `warehouse_items` owns per-company inventory state.

Specifically:

1. **`list_partial_piece_items`** — `FROM warehouse_items i JOIN warehouse_item_catalog c ON c.id = i.catalog_item_id`, select `c.item_code`, `c.name`, group by `c.item_code, c.name` too.
2. **`list_partial_pieces`** — same join, select/search on `c.item_code`, `c.name`.
3. **`next_partial_piece_code_for_item`** — read `c.item_code` via join on the catalog.
4. **`import_partial_pieces`** — lookup item by `lower(c.item_code)` for the given company.

No frontend changes; `PartialPieceItemPicker` and `usePartialPieceItems` already consume the existing RPC shape.

## Verification

- Reload `/warehouse/partial-quantities`, open Add Partial Piece → picker lists active items with code + name.
- Search by item code and by name in both the picker and the main list.
- Add a piece, then split/consume to confirm `next_partial_piece_code_for_item` works.
- Run the bulk Import flow with a known item code.

## Out of scope

- Other modules that may still reference dropped columns inside DB functions — separate audit pass (will surface on use).
- Any UI changes to the Partial Quantities page.
