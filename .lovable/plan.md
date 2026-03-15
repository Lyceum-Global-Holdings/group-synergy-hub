

# Fix: Bulk Import Creates Duplicates for Existing Items Across Companies

## Root Cause

In `BulkItemImportContent.tsx` (line 50), the hook `useWarehouseItems()` is called **without** `skipCompanyFilter`, so `existingItems` only contains items from the **currently selected company**. When an item exists in another company (or globally), it's not matched and gets inserted as a brand new item.

## Changes

### 1. `src/components/warehouse/BulkItemImportContent.tsx`

- Add a **second** call to `useWarehouseItems({ skipCompanyFilter: true })` to get ALL items across all companies for duplicate detection purposes.
- Use the all-company items list for the name-based and code-based duplicate detection (lines 346-386), so items existing in **any** company are correctly identified as duplicates or code-update candidates.
- Keep the original company-scoped `useWarehouseItems()` for the `bulkCreateItemsAsync` function (which correctly sets `company_id` on new items).
- For `update_code` items: the existing update logic (lines 523-537) already only updates `item_code` via `.update({ item_code: ... })` — this is correct and won't change `company_id`.

### Summary of behavior after fix
- **Existing item (same name, same code)** → marked as "duplicate", skipped
- **Existing item (same name, different code)** → marked as "update_code", only item_code updated (company unchanged)
- **Truly new item** → created under the selected company

