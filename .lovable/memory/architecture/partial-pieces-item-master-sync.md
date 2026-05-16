---
name: Partial Pieces ↔ Item Master sync
description: How warehouse_partial_pieces stays aligned with warehouse_item_catalog defaults and visibility
type: feature
---

# Partial Pieces ↔ Item Master sync

## Display fields
- `list_partial_pieces` and `list_partial_piece_items` join `warehouse_item_catalog` and return current `item_code`, `name`, `base_uom`, `secondary_uom`, `track_secondary_quantity`, item status. Never denormalize these onto `warehouse_partial_pieces`.

## Default propagation (trigger)
Trigger `trg_warehouse_item_catalog_propagate_defaults` (`AFTER UPDATE OF base_uom, secondary_uom, unit_cost` on `warehouse_item_catalog`):
- When `COALESCE(secondary_uom, base_uom)` changes, update `warehouse_partial_pieces.size_uom` for rows where `status='available'` AND `size_uom` still equals the OLD default. Custom UOMs are preserved.
- When `unit_cost` changes, update `warehouse_partial_pieces.unit_cost` for rows where `status='available'` AND `unit_cost` still equals OLD unit_cost. Custom overrides preserved.
- Reserved / consumed / scrapped pieces are NEVER touched (historical cost integrity).

## Picker scope
- `list_partial_piece_items` returns every active item in the master (LEFT JOIN); `piece_count` may be 0 so newly-added items are immediately selectable in the Partial Quantities filter.

## React Query invalidation
- `useWarehouseItems` create / update / bulk-import mutations invalidate `['partial-pieces']` and `['partial-piece-items']`.
- `PartialQuantities` page subscribes to realtime `warehouse_item_catalog` and invalidates both keys for cross-tab freshness.
