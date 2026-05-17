---
name: Bulk Item Master Grid
description: Excel-like grid in the Item Master tab for adding many items at once, with paste support and offline auto-classifier
type: feature
---

# Bulk Item Master Grid

Location: Item Master tab (`ItemMasterDefinitionTab` on `/warehouse/item-bin-master`), button **"Bulk create items"** next to **"Add Item"**.

Component: `src/components/warehouse/bulk-item-master/BulkItemMasterDialog.tsx` (lazy-loaded).

## Behavior
- Writes only to `warehouse_item_catalog` via existing `bulkCreateItemsAsync` from `useWarehouseItemCatalog`. No new RPC, no schema change.
- Paste: dedicated "Paste names" dialog OR paste TSV directly into the grid (first column = name). Both seed rows and run the classifier.
- Item code per row is **auto-generated but editable**:
  - Preview computed client-side as `INV-{CAT}-{NNN}` from the existing catalog max suffix plus the row's index in the category group.
  - "Auto" badge while value matches the suggestion; once edited, the badge becomes a reset (RotateCcw) icon that restores the auto value.
  - At submit time, all still-auto rows are re-allocated via `allocateItemCodes({ scope: 'catalog' })` so concurrent inserts don't clash.
- On success, calls `useInvalidateWarehouseStock()` (canonical hook — never invalidate per-key here).

## Auto-classifier (international standards)
`src/lib/itemMaster/autoClassify.ts` — pure, deterministic, zero-network.
- **UoM** via UN/CEFACT Recommendation 20 codes (`EA`, `MTR`, `KGM`, `LTR`, `MMT`, `PR`, `SET`, `BX`, `RO`, `PK`, `GRM`, …) resolved to tenant `item_units` by case-insensitive abbreviation match.
- **Category** via UNSPSC-aligned keyword dictionary (Electrical & Lighting, Plumbing, Construction materials, Paints & Coatings, Hardware & Fasteners, Tools, Safety & PPE, IT & Office, Consumables) resolved to tenant `item_categories` by case-insensitive name match.
- **Never** auto-creates a tenant category — when no match exists, surfaces the UNSPSC family as a row warning. Respects `mem://architecture/item-category-depth-cap`.

## Constraints
- Required fields: name, category, UoM. Item code uniqueness enforced both in the grid and against the live `warehouse_item_catalog` (lowercased lookup).
- Disabled rows once `status === 'imported'`.
- Tests: `src/lib/itemMaster/__tests__/autoClassify.test.ts`.
