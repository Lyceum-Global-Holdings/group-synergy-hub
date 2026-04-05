

## Filter Item Category Selector to Level 1 (Top-Level) Categories Only

### Why
Per SAP MM and UNSPSC standards, items are classified at the **material group level** (top-level category), not at sub-category levels. Sub-categories exist for organizational hierarchy but item codes are generated from the top-level category code (e.g., `NCG-ELC-000001`). Allowing sub-category selection would break the item code pattern and violate the material classification standard.

### Changes

**1. `src/components/warehouse/SingleItemForm.tsx`**
- Filter the `categories` array to only show top-level categories (`parent_id === null`) in the category `<Select>` dropdown
- Add a `useMemo` filter: `const topLevelCategories = categories.filter(c => !c.parent_id)`
- Replace `categories.map(...)` with `topLevelCategories.map(...)` in the selector
- Add a helper label/tooltip: "Material Group (Level 1)" to clarify the SAP standard

**2. `src/components/warehouse/CreateItemDialog.tsx`**
- Same change: filter to `parent_id === null` categories only
- Same label update

### What stays the same
- The full category hierarchy remains visible in the Category Management page
- Sub-categories are still useful for reporting, filtering, and organizational purposes
- Item code auto-generation logic unchanged — it already reads from the selected category's code
- Bulk import uses the same filtering

### Files to Edit
1. `src/components/warehouse/SingleItemForm.tsx`
2. `src/components/warehouse/CreateItemDialog.tsx`

