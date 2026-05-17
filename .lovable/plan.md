# Item Master — hide columns + add View Details action (frontend only)

## Scope
Single file: `src/components/warehouse/ItemMasterDefinitionTab.tsx`. No DB, query, or filter logic changes.

## Changes

1. **Hide Brand, Supplier, Barcode / SKU columns (UI only)**
   - Remove `brand`, `supplier`, `barcode_sku` entries from `COLUMN_DEFS` so they no longer render in the table header/body or appear in the Columns toggle menu.
   - Remove the three `<TableHead>` cells and three `<TableCell>` blocks for those columns.
   - Leave the Supplier filter dropdown, supplier query, search-by-barcode/sku, and Excel export untouched — data still loads as before; only the visible columns shrink. This slightly reduces DOM size per row.

2. **Add "View details" action**
   - Add `Eye` icon button in the Actions cell (before Edit) with tooltip "View Details".
   - Add local state `viewingItem` and render `<ItemDetailsDialog item={viewingItem} open={!!viewingItem} onOpenChange={(o) => !o && setViewingItem(null)} />`.
   - Existing Edit (pencil) button stays — both view and edit available.

## Out of scope
- No backend, RPC, query, index, or filter changes.
- No changes to Inventory tab or other tabs.
