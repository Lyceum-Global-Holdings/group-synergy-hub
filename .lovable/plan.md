## Goal
Reorder Request Items columns in `CreateAssetRequestDialog.tsx` to: **Type, Category, Sub-category, Asset/Item, Description, Quantity**.

## Changes (single file: `src/components/warehouse/asset-requests/CreateAssetRequestDialog.tsx`)

1. **Column header order**: Type | Category | Sub-category | Asset/Item | Description | Quantity | (delete).
2. **Row order**: rearrange the existing cells to match.
3. **Add Description column**:
   - Extend `RequestItem` with `description?: string`.
   - Render a text input bound to `item.description`, patched via `handleItemPatch`.
   - When `request_type === "from_master"` and an asset is selected, auto-fill description from the asset master record (model / specifications) on selection; remains editable.
   - Include `description` in the payload sent to `asset_request_items` (column already exists on the table — no migration).
4. Adjust column widths so the dialog stays balanced at `max-w-5xl` (description gets `min-w-[180px]`, others tightened).

## Out of scope
No DB migration, no changes to validation rules, list view, or approval flow.
