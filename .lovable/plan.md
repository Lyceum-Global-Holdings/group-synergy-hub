# Fix: Item Master shows all items regardless of stock

## Why items appear "missing"

Confirmed for the example `INV-ELC-000-0878`:

| Source | Present? | Stock | Status |
|---|---|---|---|
| `warehouse_items` (the master) | Yes | 0 | inactive |
| `warehouse_item_catalog` (global catalog) | Yes | — | — |

The item was **never deleted**. It is hidden by a hard filter in the Inventory tab's data hook:

```ts
// src/hooks/useWarehouseItemsLazyInventory.ts (line ~134)
let query = supabase
  .from('warehouse_items')
  .select(`*, supplier:suppliers(id, name)`)
  .gt('current_stock', 0);   // ← silently excludes every zero-stock item
```

When a global location is also selected, the alternate RPC `get_company_inventory_at_location` is used, which only returns items physically present at that location — same symptom.

This violates the SAP MM standard separation:

- **Material Master display (MM03 / Item Master)** must list **every** item record regardless of stock or location.
- **Stock Overview (MMBE)** is the screen that filters by on-hand quantity / location.

The page `/warehouse/inventory` exposes the **Item Master** tab — it should behave like MM03, not like MMBE.

## Plan

### 1. Lift the implicit stock filter — `useWarehouseItemsLazyInventory.ts`

- Remove the unconditional `.gt('current_stock', 0)` clause from the standard paginated path.
- Keep the existing optional filters (`status`, `category_id`, `supplier_id`, `search`) intact.
- The location-scoped RPC path is left for the explicit "view stock at this location" use case (when the user sets a global location). Document this branch in a code comment so it isn't mistaken for a bug.

### 2. Add an explicit Stock filter — `ItemMasterTab.tsx`

Add a new toolbar `Select` next to the existing Status filter, default **"All stock"**:

| Option | Behavior |
|---|---|
| All stock *(default)* | No client filter — full master list |
| In stock (> 0) | `current_stock > 0` |
| Zero stock | `current_stock = 0` |
| Low stock (≤ reorder level) | `current_stock <= reorder_level` |

Filter is applied client-side over the loaded page (consistent with the existing `supplierId` / `status` filtering pattern). This gives operators the SAP-style choice while preserving the master view as default.

### 3. Backend RPC parity — `list_warehouse_inventory`

- Add an optional `_stock_mode text` parameter (`null | 'in_stock' | 'zero' | 'low'`) so the future server-paginated path can apply the same filter at SQL level. No behavior change when the parameter is omitted.

### 4. Out of scope

- Permanent purge / delete logic (already shipped in the previous turn — verified `INV-ELC-000-0878` row still exists, no deletion regression).
- The `get_company_inventory_at_location` RPC keeps its location-scoped semantic; the user simply must clear the global location to see the full master.
- The unrelated React DevTools "Maximum call stack size exceeded" warning.

## Files

- `src/hooks/useWarehouseItemsLazyInventory.ts` — drop `.gt('current_stock', 0)`; add `stockMode` parameter.
- `src/components/warehouse/ItemMasterTab.tsx` — wire new Stock filter Select; pass `stockMode` to the hook.
- New migration — add optional `_stock_mode` parameter to `list_warehouse_inventory` (no-op when null).
