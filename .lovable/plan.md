## Stage 2 — Catalog-First Write Contract

Goal: make `warehouse_item_catalog` the single source of truth for item master attributes. `warehouse_items` keeps only per-company stock + economics; mirrored master columns become trigger-maintained read caches.

### Mirrored columns (cache from catalog → warehouse_items)
`name`, `description`, `category_id`, `unit_id`, `brand`, `manufacturer`, `supplier_id`, `barcode`, `sku`, `image_url`, `is_serialized`, `is_batch_tracked`

### Per-company columns (stay writable on warehouse_items)
`current_stock`, `reserved_quantity`, `available_quantity` (generated), `location_id`, `base_uom`, `secondary_uom`, `track_secondary_quantity`, `reorder_level`, `min_stock_level`, `max_stock_level`, `unit_cost`, `selling_price`, `status`, `notes`, `item_code` (mirrored but stable)

### Database migration

1. **`wh_items_sync_from_catalog`** — BEFORE INSERT OR UPDATE trigger on `warehouse_items`. Looks up the linked catalog row by `NEW.catalog_item_id` and overwrites every mirrored column on `NEW` so any client-supplied values are ignored. Also forces `NEW.item_code = catalog.item_code`.

2. **`wh_catalog_propagate`** — AFTER UPDATE trigger on `warehouse_item_catalog`. When any mirrored column changes, one `UPDATE warehouse_items SET ... WHERE catalog_item_id = NEW.id` propagates to every company in a single statement. Skipped when only `updated_at` changes.

3. **`upsert_warehouse_inventory(p_company_id, p_catalog_item_id, p_location_id, p_base_uom, p_secondary_uom, p_track_secondary, p_reorder_level, p_min_stock, p_max_stock, p_unit_cost, p_selling_price, p_status, p_notes)`** — SECURITY INVOKER RPC. Inserts a `warehouse_items` row (mirrored fields filled by the BEFORE trigger) or updates the existing `(company_id, catalog_item_id)` row's per-company columns only. Returns the row id. Does not accept any mirrored field.

4. **`update_warehouse_catalog_item(p_catalog_item_id, ...)`** — SECURITY INVOKER RPC for editing master attributes. Updates the catalog row; the AFTER trigger fans out to all companies.

5. Backfill `item_code` parity once more inside the migration to guarantee zero drift before triggers activate.

### Frontend changes

- **`src/hooks/useWarehouseItems.ts`** — both insert paths (single + bulk) switch to `supabase.rpc('upsert_warehouse_inventory', ...)`. Stop sending mirrored fields. Update path: split into two calls — `update_warehouse_catalog_item` for master edits, `upsert_warehouse_inventory` for per-company edits. The two-call orchestration lives in the hook so callers stay unchanged.
- **`src/hooks/warehouse/useWarehouseCatalog.ts`** (if present) — catalog updates route through `update_warehouse_catalog_item`.
- Bulk import path keeps the existing catalog-first dual flow but inventory inserts go through the RPC.

### Verification
- Add a one-shot SQL check in the migration: after triggers are created, run `SELECT count(*) FROM warehouse_items wi JOIN warehouse_item_catalog c ON c.id = wi.catalog_item_id WHERE wi.name IS DISTINCT FROM c.name OR wi.is_serialized IS DISTINCT FROM c.is_serialized` and `RAISE` if non-zero.
- Manual smoke after deploy: edit a catalog row's `name` → confirm all company rows update; insert a `warehouse_items` row with a bogus `name` via RPC → confirm catalog value wins.

### Out of scope (Stage 3+)
Dropping mirrored columns, unified reader RPCs (`list_warehouse_inventory`), migrating the 21 raw `from('warehouse_items')` reader files, and deprecating direct PostgREST writes.
