## Stage 6 — Finish the Catalog Source-of-Truth Cleanup

Goal: eliminate the last direct PostgREST writes against `warehouse_items` mirrored fields, then drop the mirrored columns entirely. Stages 1–5 made the catalog the source of truth via triggers + RPCs; this stage removes the now-redundant cache columns and the legacy code paths that wrote to them.

### Scope: 8 writer files migrating to RPCs

These are the only files still issuing `INSERT` / `UPDATE` against `warehouse_items` (readers are unaffected because mirrored columns are dropped — readers switch to joined views):

| File | Current behavior | New behavior |
|---|---|---|
| `AddFromCatalogDialog.tsx` | Direct insert with all mirrored fields + update path | `upsert_warehouse_inventory` RPC |
| `BulkStockUploadDialog.tsx` | Direct upsert with mirrored fields (~2 sites) | `upsert_warehouse_inventory` RPC |
| `BulkItemImportDialog.tsx` | Direct insert during import | `upsert_warehouse_inventory` RPC (catalog already dual-written) |
| `BulkInventoryUpdateDialog.tsx` | Bulk `.update()` on per-company fields | `upsert_warehouse_inventory` RPC per row |
| `BulkInventoryDeleteDialog.tsx` | `.update({status:'inactive'})` | `upsert_warehouse_inventory` RPC (status only) |
| `AssignLocationDialog.tsx` | `.update({location_id})` | `upsert_warehouse_inventory` RPC (location only) |
| `FixMissingOpeningStockDialog.tsx` | Reads + writes opening stock | Reader switches to RPC; writes via `upsert_warehouse_inventory` |
| `useWarehouseItems.ts` insert path (single + bulk) | Already partially migrated in Stage 3 | Verify both paths use RPC; remove dead code |

### Reader migration (21 files)

After mirrored columns are dropped, the 21 reader files that `select` mirrored columns from `warehouse_items` will break. Two-step migration:

1. **Create DB view `warehouse_items_full`** — `SELECT wi.*, c.name, c.description, c.category_id, c.unit_id, c.brand, c.manufacturer, c.supplier_id, c.barcode, c.sku, c.image_url, c.is_serialized, c.is_batch_tracked FROM warehouse_items wi LEFT JOIN warehouse_item_catalog c ON c.id = wi.catalog_item_id`. SECURITY INVOKER (default for views), inherits RLS from base tables.
2. **Mechanical rename**: every reader switches `from('warehouse_items')` → `from('warehouse_items_full')`. Readers that already only select per-company columns stay on `warehouse_items`.

### Database migration

1. `CREATE OR REPLACE VIEW public.warehouse_items_full AS SELECT ...` exposing mirrored columns from catalog join.
2. `GRANT SELECT ON public.warehouse_items_full TO authenticated`.
3. After all frontend changes ship and bake for 1 day: a follow-up migration drops mirrored columns from `warehouse_items` and the `wh_items_sync_from_catalog` BEFORE trigger (no longer needed once columns are gone). The `wh_catalog_propagate` AFTER trigger is also removed. `reconcile_catalog_mirror` and `check_catalog_mirror_parity` get dropped along with the nightly cron job.

### Phased rollout

- **Phase 6a (this PR)**: Create `warehouse_items_full` view + migrate the 8 writer files + mechanical-rename the 21 reader files. Mirrored columns stay in place as a safety net.
- **Phase 6b (next PR, after 24h soak)**: Drop mirrored columns, sync trigger, propagate trigger, reconcile RPCs, and cron job. Update Stage 2 / Stage 5 memory entries to "deprecated".

### Verification

- Pre-drop SQL audit: `SELECT count(*) FROM warehouse_items wi JOIN warehouse_item_catalog c ON c.id = wi.catalog_item_id WHERE wi.name IS DISTINCT FROM c.name` must be 0 right before phase 6b.
- Manual smoke: add from catalog, bulk upload stock, assign location, bulk update, bulk delete — confirm each succeeds and the inventory page still shows correct names/brands.
- Build: TypeScript compile passes (the regenerated `types.ts` will surface any missed reader).

### Risk

- The view layer means readers don't need column-level rewrites — just table name swaps. Low risk.
- Writer migration is mostly mechanical: replace insert/update blocks with one RPC call. Behavior preserved.
- Phase 6b is deferred so we can roll back column drop independently if production surfaces an edge case.

Want me to start with Phase 6a?