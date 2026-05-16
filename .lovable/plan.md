## Goal

Keep Partial Pieces tightly synced with Item Master so:

1. **Edits to Item Master appear live** in the Partial Pieces list, group headers, exports and filters.
2. **UOM / unit-cost defaults propagate** to existing *available* partial pieces when the item's defaults change.
3. **All active items in Item Master are pickable** in the Partial Pieces parent-item filter (not only items that already have pieces).

## Behavior

### 1. Live reflection of Item Master edits

- `list_partial_pieces` and `list_partial_piece_items` already join `warehouse_items` for display fields. Confirm columns selected: `item_code`, `item_name`, `base_uom`, `secondary_uom`, `track_secondary_quantity`, `unit_cost`. Add the ones missing so the UI never reads stale denormalized data.
- React Query wiring: when item master mutations succeed (`useUpsertWarehouseItem`, bulk import, category/UOM edits), invalidate `["partial-pieces"]` and `["partial-piece-items"]` in addition to existing keys.
- Realtime: extend the shared realtime bus subscription on `warehouse_items` to also invalidate the two partial-piece query keys (debounced, company-scoped) so other open tabs refresh.

### 2. Picker shows every active item (not just items with pieces)

- Replace `usePartialPieceItems` source with the existing item-master list used by `AddPartialPieceDialog` (`useWarehouseItems` / `ItemSelector`), respecting the global location filter for stock visibility but **not** filtering out items with zero pieces.
- Group rows for items without any pieces are not rendered in the table (the table is about existing pieces), but the **parent-item filter dropdown** at the top of `PartialQuantities` will list every active item. Show a small "0 pieces" hint next to items that have none.
- Keep `list_partial_piece_items` for the legacy "items that have pieces" use cases (badge counts), but switch the filter dropdown to the full master.

### 3. Default propagation on Item Master update

New DB trigger `trg_warehouse_items_propagate_defaults` on `warehouse_items` AFTER UPDATE:

- When `base_uom` or `secondary_uom` change: update `warehouse_partial_pieces.size_uom` for rows where `status = 'available'`, `parent_item_id = NEW.id`, and `size_uom = OLD.secondary_uom OR OLD.base_uom` (i.e. rows still on the old default). Rows with a custom UOM are left alone.
- When `unit_cost` changes: update `warehouse_partial_pieces.unit_cost` for rows where `status = 'available'`, `parent_item_id = NEW.id`, and `unit_cost = OLD.unit_cost` (still at old default; custom overrides preserved). Consumed/scrapped/reserved pieces are never touched (historical cost integrity).
- Trigger is `SECURITY DEFINER`, sets `search_path = public`, and is wrapped in a single statement per column group to keep it cheap. Adds a row to `audit_logs` summarising affected piece count.

### 4. Frontend invalidations

- `useUpsertWarehouseItem` and bulk-item-import success handlers: add `qc.invalidateQueries({ queryKey: ["partial-pieces"] })` and `["partial-piece-items"]`.
- `usePartialPieces` keeps `staleTime: 0`; `usePartialPieceItems` already at 30 s — fine.

## Technical Details

**Migration**

```sql
CREATE OR REPLACE FUNCTION public.warehouse_items_propagate_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uom_updates int := 0;
  v_cost_updates int := 0;
BEGIN
  IF NEW.base_uom IS DISTINCT FROM OLD.base_uom
     OR NEW.secondary_uom IS DISTINCT FROM OLD.secondary_uom THEN
    UPDATE warehouse_partial_pieces
       SET size_uom = COALESCE(NEW.secondary_uom, NEW.base_uom),
           updated_at = now()
     WHERE parent_item_id = NEW.id
       AND status = 'available'
       AND size_uom IS NOT DISTINCT FROM COALESCE(OLD.secondary_uom, OLD.base_uom);
    GET DIAGNOSTICS v_uom_updates = ROW_COUNT;
  END IF;

  IF NEW.unit_cost IS DISTINCT FROM OLD.unit_cost THEN
    UPDATE warehouse_partial_pieces
       SET unit_cost = NEW.unit_cost,
           updated_at = now()
     WHERE parent_item_id = NEW.id
       AND status = 'available'
       AND unit_cost IS NOT DISTINCT FROM OLD.unit_cost;
    GET DIAGNOSTICS v_cost_updates = ROW_COUNT;
  END IF;

  IF v_uom_updates + v_cost_updates > 0 THEN
    INSERT INTO audit_logs (company_id, entity_type, entity_id, action, payload)
    VALUES (NEW.company_id, 'warehouse_item', NEW.id,
            'partial_pieces_defaults_propagated',
            jsonb_build_object('uom_updates', v_uom_updates, 'cost_updates', v_cost_updates));
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_warehouse_items_propagate_defaults
AFTER UPDATE OF base_uom, secondary_uom, unit_cost ON warehouse_items
FOR EACH ROW EXECUTE FUNCTION public.warehouse_items_propagate_defaults();
```

**RPC update**: ensure `list_partial_pieces` returns `secondary_uom` and `track_secondary_quantity` (so UI hints stay correct after master edits).

**Files**

- New migration: `supabase/migrations/<ts>_partial_pieces_master_sync.sql` (function + trigger + RPC refresh).
- `src/hooks/warehouse/usePartialPieces.ts` — invalidation helper covers item master keys; (no further client logic needed).
- `src/hooks/useWarehouseItems.ts` — on upsert/import success, also invalidate `["partial-pieces"]` and `["partial-piece-items"]`.
- `src/pages/warehouse/PartialQuantities.tsx` — parent-item filter dropdown sources from `useWarehouseItems` (filtered to `status='active'`) instead of `usePartialPieceItems`; show "0 pieces" hint where applicable.
- Realtime bus: add `warehouse_items` channel handler that debounce-invalidates the two partial-piece keys.
- Memory note: `mem://architecture/partial-pieces-item-master-sync.md` documenting the propagation rules (only `available` rows updated; historical cost on consumed pieces preserved).

## Out of scope

- Auto-creating placeholder pieces for new items (explicitly not requested).
- Backfilling/rewriting historical UOM or cost on consumed/scrapped/reserved pieces.
- Cross-company propagation (multi-tenant isolation untouched).
