## Stage 6b — Drop Mirrored Columns and Retire Sync Machinery

Goal: complete the catalog source-of-truth migration by removing the now-redundant mirrored columns from `warehouse_items` and tearing down the trigger/reconcile/cron safety net that existed to keep them in sync. After this stage, the global catalog is the only place that stores item master attributes; per-company rows only store stock + economics.

### Pre-flight invariants (run before any drop)

1. `SELECT count(*) FROM warehouse_items wi JOIN warehouse_item_catalog c ON c.id = wi.catalog_item_id WHERE wi.name IS DISTINCT FROM c.name OR wi.is_serialized IS DISTINCT FROM c.is_serialized OR wi.category_id IS DISTINCT FROM c.category_id` must return 0.
2. `SELECT count(*) FROM warehouse_items WHERE catalog_item_id IS NULL` must return 0. If non-zero, abort — those rows would lose their master data when the columns drop.
3. `check_catalog_mirror_parity()` returns drift_count = 0.

If any check fails, run `reconcile_catalog_mirror()` and re-verify.

### Frontend writer cleanup (must ship before the column-drop migration)

Eight call sites still INSERT or UPDATE mirrored fields directly. PostgREST inserts that mention dropped columns will error, so each must be rewritten first.

| File | Current writes | New writes |
|---|---|---|
| `src/hooks/useWarehouseItems.ts` createItem (L190) | `insert({...itemData, catalog_item_id, company_id, created_by})` where itemData includes name/sku/etc | `rpc('upsert_warehouse_inventory', {...per-company only})` — already resolves catalogRow above |
| `src/hooks/useWarehouseItems.ts` bulkCreate (L437) | `insert(itemsWithUser)` array | Loop calling `upsert_warehouse_inventory` (or new bulk RPC — see "Out of scope") |
| `src/components/warehouse/AddFromCatalogDialog.tsx` insert path (L177) | `insert` with all mirrored fields + current_stock + location_id | `rpc('upsert_warehouse_inventory', ...)` then a separate `update({current_stock})` for the opening qty |
| `src/components/warehouse/AddFromCatalogDialog.tsx` update path (L162) | `update({current_stock, status, location_id})` | No change — only per-company fields, stays on `warehouse_items` |
| `src/components/warehouse/BulkStockUploadDialog.tsx` (L473, L500) | `update`/`insert` with mirrored fields (name, etc.) | Strip mirrored fields from the payload; for new rows call `upsert_warehouse_inventory` then patch `current_stock` |
| `src/components/warehouse/BulkItemImportDialog.tsx` (L456) | `insert` with mirrored fields after catalog dual-write | Replace with `upsert_warehouse_inventory` — mirrored fields already live in catalog |
| `src/components/warehouse/BulkInventoryUpdateDialog.tsx` (L51) | `update(updates)` where `updates` is built from form | Whitelist per-company keys only (`current_stock`, `reorder_level`, etc.); if any mirrored key sneaks through, route it via `update_warehouse_catalog_item` |
| `src/components/warehouse/BulkInventoryDeleteDialog.tsx` (L70), `AssignLocationDialog.tsx` (L129), `useRoomMaterialTransactions.ts` (L117, L222), `useWarehouseItems.ts` discontinue/delete (L336/344/381) | `update({status})` / `update({location_id})` / `update({current_stock})` / `delete()` | No change — these touch only per-company columns or delete the row |

After this pass, every remaining `from('warehouse_items')` call is either a `delete()` or an `update()`/`insert()` whose payload contains only per-company columns.

A grep-based regression check is added to CI (or the migration's pre-flight): any `.from('warehouse_items')` followed by a payload that names any of the 13 mirrored columns fails the lint.

### Database migration

Runs only after the writer cleanup PR has shipped and soaked for at least 24h with zero errors in the function logs.

```sql
-- 1. Drop the BEFORE/AFTER triggers (no longer needed once columns are gone)
DROP TRIGGER IF EXISTS wh_items_sync_from_catalog ON public.warehouse_items;
DROP FUNCTION IF EXISTS public.wh_items_sync_from_catalog();
DROP TRIGGER IF EXISTS wh_catalog_propagate ON public.warehouse_item_catalog;
DROP FUNCTION IF EXISTS public.wh_catalog_propagate();

-- 2. Drop the mirrored columns
ALTER TABLE public.warehouse_items
  DROP COLUMN item_code,
  DROP COLUMN name,
  DROP COLUMN description,
  DROP COLUMN category_id,
  DROP COLUMN unit_id,
  DROP COLUMN brand,
  DROP COLUMN manufacturer,
  DROP COLUMN supplier_id,
  DROP COLUMN barcode,
  DROP COLUMN sku,
  DROP COLUMN image_url,
  DROP COLUMN is_serialized,
  DROP COLUMN is_batch_tracked;

-- 3. Recreate the warehouse_items_full view (CASCADE on column drop will have killed it)
CREATE OR REPLACE VIEW public.warehouse_items_full
  WITH (security_invoker = true)
  AS SELECT wi.*, c.item_code, c.name, c.description, c.category_id, c.unit_id,
            c.brand, c.manufacturer, c.supplier_id, c.barcode, c.sku, c.image_url,
            c.is_serialized, c.is_batch_tracked
     FROM public.warehouse_items wi
     LEFT JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id;
GRANT SELECT ON public.warehouse_items_full TO authenticated;

-- 4. Retire the safety-net machinery
SELECT cron.unschedule('catalog-mirror-nightly-reconcile');
DROP FUNCTION IF EXISTS public.reconcile_catalog_mirror();
DROP FUNCTION IF EXISTS public.check_catalog_mirror_parity();

-- 5. Enforce catalog_item_id NOT NULL (it was already in practice)
ALTER TABLE public.warehouse_items
  ALTER COLUMN catalog_item_id SET NOT NULL;
```

Also drop any indexes that referenced the dropped columns (e.g. `idx_warehouse_items_item_code`, `idx_warehouse_items_name_trgm`) and recreate equivalents on `warehouse_item_catalog` if they're not already there.

### Server-side reader audit

Several RPCs and policies select mirrored columns from `warehouse_items` directly. Audit and migrate any that do:

- `list_warehouse_inventory` — already joins catalog, verify it doesn't reference `wi.name`/`wi.item_code` etc.
- RLS policies referencing `is_serialized` or `is_batch_tracked` on `warehouse_items`.
- Any function that does `SELECT name FROM warehouse_items` — switch to `warehouse_items_full` or join catalog.

Search query for the audit:
```sql
SELECT n.nspname, p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ~* 'warehouse_items\\.(name|item_code|category_id|brand|sku|barcode|is_serialized|is_batch_tracked)';
```

### Verification

1. Build passes — regenerated `types.ts` will surface any missed reader (mirrored columns disappear from `warehouse_items` Row type).
2. Manual smoke flow:
   - Inventory tab loads with names and brands populated.
   - Edit catalog item name → confirm all per-company inventory rows show the new name (via the view).
   - Create new inventory row via Add Item form.
   - Add from Catalog → row appears with stock and pulls master attrs from catalog.
   - Bulk stock upload → all rows succeed.
   - Bulk update / bulk delete / assign location → succeed.
3. Cron job `catalog-mirror-nightly-reconcile` no longer exists in `cron.job`.

### Memory updates

- `mem://architecture/warehouse-catalog-source-of-truth` — update to Stage 6: mirrored columns dropped, the view is the read surface.
- `mem://features/warehouse/catalog-mirror-reconciliation` — mark as **retired** (Stage 6b removed it).
- `mem://index.md` Core rule — change "Mirrored fields are trigger-maintained read caches" to "Mirrored fields live only in `warehouse_item_catalog`; read them via `warehouse_items_full`."

### Risk and rollback

- The column drop is irreversible without restoring from backup. The Stage 5 reconcile pre-flight + the 24h soak after the writer-cleanup PR mitigate the data-loss risk.
- If the drop ships but a missed reader crashes a screen, rollback is to recreate the column as a generated/expression column that reads from the join. Acceptable as a hot patch.
- The view depends on `warehouse_item_catalog.id` integrity; the new `NOT NULL` constraint on `catalog_item_id` prevents orphan inventory rows from going invisible.

### Out of scope

- Building a bulk `upsert_warehouse_inventory_many` RPC. The per-row loop is fine for the current call volumes; revisit if bulk import latency becomes an issue.
- Migrating the readers in edge functions (none currently reference mirrored columns based on a quick scan — verify in the audit step).