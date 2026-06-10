# GRN: Show full Item Master + Fix Batch Code Generation

## Root cause

**Items not loading**

`CreateGrnDialog` populates the "Add item" combobox from `useWarehouseItems()`, which queries `warehouse_items_full` filtered by the active `company_id`. That table only contains items that have already been *provisioned* to the selected company (via `upsert_warehouse_inventory`). Anything that exists in the global item master (`warehouse_item_catalog`) but hasn't been provisioned to this company is invisible — so most companies see a near-empty picker even though the master has thousands of items.

Receiving goods is exactly the moment a catalog item should *enter* a company's inventory, so the picker must offer the full global master.

**Batch code generation error**

`generate_batch_number(_company_id, _warehouse_item_id)` resolves `item_code` by looking up `warehouse_items WHERE id = ? AND company_id = ?`. As soon as the picker offers catalog items that aren't yet in `warehouse_items` for the company, the lookup misses and (combined with no per-company row) the helper can also fail downstream when `item_batches` is inserted referencing a non-existent `warehouse_item_id`. The user sees a toast: *"Failed to generate batch number"*.

## Fix

Switch the GRN picker to read the **global catalog** and auto-provision the per-company inventory row the moment an item is chosen. Batch generation then has a guaranteed `warehouse_items` row to anchor to.

### 1. CreateGrnDialog — source items from the catalog

- Replace `useWarehouseItems()` with `useWarehouseItemCatalog()` (already authenticated-readable, RLS-clean, returns all master items).
- The combobox renders catalog rows (`item_code`, `name`, `is_batch_tracked`, `is_serialized`, `unit_cost`, `secondary_uom`, `track_secondary_quantity` come from catalog).
- Search/filter logic stays the same — just over catalog rows.

### 2. Provision-on-select

When a user picks a catalog item:

1. Call new RPC `ensure_warehouse_item_for_company(p_company_id, p_catalog_item_id)`  
   - Wraps the existing `upsert_warehouse_inventory` logic.
   - Returns the `warehouse_items.id` (existing or newly inserted with `status='active'`, zero stock, no location/bin).
2. Store that id in `grn_items.warehouse_item_id` as today.
3. Continue with the existing batch-number auto-generation call — it now finds the row.

This keeps `grn_items`, the approval flow, and `GrnBinAllocationDialog` unchanged (they already key on `warehouse_item_id`).

### 3. Harden `generate_batch_number`

Make the function tolerant of the legacy case (called before provisioning completes) by falling back to the catalog:

```sql
CREATE OR REPLACE FUNCTION public.generate_batch_number(
  _company_id uuid, _warehouse_item_id uuid
) ...
-- Resolve item_code from warehouse_items first; if NULL, fall back to
-- warehouse_item_catalog via warehouse_items.catalog_item_id, then to 'ITEM'.
```

Everything else in the function (advisory lock, sequence, GS1 AI(10) format) stays.

### 4. New RPC

```sql
CREATE OR REPLACE FUNCTION public.ensure_warehouse_item_for_company(
  p_company_id uuid,
  p_catalog_item_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM warehouse_items
   WHERE company_id = p_company_id AND catalog_item_id = p_catalog_item_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_id := upsert_warehouse_inventory(
    p_company_id      => p_company_id,
    p_catalog_item_id => p_catalog_item_id,
    p_location_id     => NULL,
    p_base_uom        => NULL, p_secondary_uom => NULL,
    p_track_secondary => false,
    p_reorder_level   => NULL, p_min_stock_level => NULL, p_max_stock_level => NULL,
    p_unit_cost       => NULL, p_selling_price  => NULL,
    p_status          => 'active', p_notes => NULL
  );
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.ensure_warehouse_item_for_company(uuid, uuid)
  TO authenticated;
```

## Files touched

- `supabase/migrations/<new>.sql` — `ensure_warehouse_item_for_company` + hardened `generate_batch_number`.
- `src/components/warehouse/CreateGrnDialog.tsx` — swap data source, add provision-on-select, keep batch-gen call.

No changes to `grn_items` schema, `GrnDetailsDialog`, approval/allocation flow, or stock movement logic.

## Result

- Every item in the global item master appears in the GRN "Add item" picker for every authenticated user.
- Selecting an unprovisioned item silently creates the company's inventory row, so the GRN proceeds normally and batch numbers generate without errors.
- Batch generation is also defensively safe if ever called before provisioning.
