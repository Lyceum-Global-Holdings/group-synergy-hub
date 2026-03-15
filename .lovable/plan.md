

# Fix: Bulk Import Name-Based Duplicate Detection Not Working

## Root Cause

The name matching logic at line 346-349 of `BulkItemImportContent.tsx` has a company_id mismatch problem:

```typescript
const existingByName = existingItems.find(
  existing =>
    existing.name?.toLowerCase() === item.name!.toLowerCase() &&
    existing.company_id === (item.company_id || companyId)  // ← THIS FAILS
);
```

- `existingItems` is already filtered by the `useWarehouseItems` query (company-filtered or all)
- But the comparison re-checks `company_id` using `selectedCompany?.id || ''`
- When "viewing all companies," `selectedCompany` may be null → `companyId = ''` → never matches any existing item
- When the CSV row has no `company` column, `item.company_id` is undefined, fallback to `companyId` which may not match the existing item's actual company_id
- Result: every item is treated as "new" and inserted as a duplicate

## Fix

### `BulkItemImportContent.tsx`

**Remove the redundant company_id check from name matching.** The `existingItems` list is already company-filtered by `useWarehouseItems`. Double-checking company_id is unnecessary and causes false negatives.

Change the matching logic to:

1. **Name matching**: Match by name only (case-insensitive) against `existingItems` — the query already handles company scoping
2. **Item code uniqueness check**: Same fix — remove redundant company_id check since items are pre-filtered
3. **SKU uniqueness check**: Same fix

This is a 3-line change affecting the `find`/`some` calls at lines 346-349, 354-358, and 366-370.

