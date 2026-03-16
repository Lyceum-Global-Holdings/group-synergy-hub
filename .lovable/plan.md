

# Fix: Allow re-importing catalog items after inventory removal

## Problem
Line 56-60 in `AddFromCatalogDialog.tsx` fetches ALL `warehouse_items` for the company with a non-null `catalog_item_id` — including items with `current_stock = 0` (removed items). These are added to the exclusion set, preventing re-import.

## Fix
Add `.gt('current_stock', 0)` to the query on line 59 so that removed items (stock = 0) are not excluded from the catalog import list.

### File: `src/components/warehouse/AddFromCatalogDialog.tsx`
**Line 59** — add filter:
```typescript
.not('catalog_item_id', 'is', null)
.gt('current_stock', 0);   // ← add this line
```

Single line change. No other files affected.

