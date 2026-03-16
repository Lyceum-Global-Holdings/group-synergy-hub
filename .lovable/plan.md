

# Fix: Duplicate key constraint violation on catalog import

## Problem

The "Import from Catalog" flow checks for existing inventory rows by `catalog_item_id` (line 137-142), but the database unique constraint is on `(item_code, company_id)`. If a row already exists with the same `item_code` for this company — but was created independently (not via catalog import, or linked to a different catalog entry) — the `catalog_item_id` check finds nothing, and the fresh insert on line 179 hits the unique constraint.

## Fix

**File: `src/components/warehouse/AddFromCatalogDialog.tsx`**

Expand the existing-row check to also match by `item_code + company_id` as a fallback:

```typescript
// Check by catalog_item_id first, then fallback to item_code
const { data: existingRow } = await supabase
  .from('warehouse_items')
  .select('id')
  .eq('company_id', selectedCompany.id)
  .or(`catalog_item_id.eq.${selectedItem.id},item_code.eq.${selectedItem.item_code}`)
  .maybeSingle();
```

This ensures that if any row already exists for this company with the same catalog link **or** the same item code, the mutation will update/reactivate it instead of attempting a conflicting insert.

### Files to modify
- `src/components/warehouse/AddFromCatalogDialog.tsx` — 1 query change (lines 137-142)

