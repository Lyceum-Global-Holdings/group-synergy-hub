## Goal
In `Create Asset Request`:
1. Fix the bug where items selected "From Master" don't get added (silent state loss).
2. Add **Category** and **Subcategory** selectors on each request line — auto-filled when picked from Asset Master, manually selectable for "New Item". This matches international procurement standards (ISO 55000 / UNSPSC-style classification per request line) so every requested asset carries a category code through approval → purchase → GRN.

## Root cause of "asset not added when selecting from master"
`AssetMasterSelector.onAssetSelected` fires three sequential `handleItemChange` calls (`asset_master_id`, `item_name`, `brand`). Each call clones from the stale `items` closure, so the last `setItems` **overwrites** the previous two — `asset_master_id` ends up `undefined` and validation rejects the row.

Fix: switch `handleItemChange` to functional `setItems(prev => …)` and add a single `handleItemPatch(index, partial)` helper. Then `onAssetSelected` does one patch carrying `asset_master_id + item_name + brand + category_id + subcategory_id` atomically.

## Changes

### 1. `src/components/warehouse/asset-requests/CreateAssetRequestDialog.tsx`
- Add `category_id?: string` and `subcategory_id?: string` to `RequestItem`.
- Replace `handleItemChange` with a functional updater and add `handleItemPatch(index, partial)`.
- Wire `AssetMasterSelector.onAssetSelected` to a single `handleItemPatch` call that sets `asset_master_id`, `item_name`, `brand`, `category_id`, `subcategory_id` together.
- Expand the items table: add **Category** and **Subcategory** columns (between Asset/Item and Quantity). Use `Select` populated from `useAssetCategories()`:
  - Category options = `mainCategories`.
  - Subcategory options = `getSubcategories(item.category_id)`; disabled until category chosen; cleared when category changes.
  - When `request_type === "from_master"` and an asset is selected, the selects are **read-only display** (value taken from the asset master record); when `new_item`, fully editable.
- Selecting a different category clears `subcategory_id` to avoid orphan pairs.
- Widen the dialog (`max-w-5xl`) and the items card to accommodate two new columns; stack category/subcategory under the item on small screens via `min-w-[160px]` cells.

### 2. Validation (`handleSubmit`)
- Require `category_id` on every line (subcategory remains optional — many real-world asset categories don't have children).
- Keep existing master vs new-item rules.

### 3. Payload
- Include `category_id` and `subcategory_id` in each item inserted into `asset_request_items` (columns already exist on the table — no migration needed).
- Backfill from master if user didn't override.

### Out of scope
- No DB migration (columns exist).
- No changes to approval/HOD workflow, list view, or details dialog. (Display of category in list view can be a follow-up.)

## Technical notes
- `useAssetCategories` already exposes `mainCategories` and `getSubcategories(parentId)` — reuse as-is.
- `asset_request_items.category_id` / `subcategory_id` are nullable `uuid` columns, FK-free in current schema, so storing the asset_categories UUID is safe.
- Functional `setItems` eliminates a class of race conditions in any future multi-field updater on this dialog.
