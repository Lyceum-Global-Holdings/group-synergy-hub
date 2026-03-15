

# Fix: Bulk Item Import Failure

## Root Cause Analysis

The "Failed to import items" error is likely caused by one or more of these issues:

1. **Empty string SKUs violating unique constraint**: The `warehouse_items_sku_company_id_key` constraint treats empty strings `""` as equal values. If multiple CSV rows have no SKU, the parsing code on line 284 sets `value || undefined` which correctly handles empty values — but if any row has a whitespace-only SKU, it could still pass through as a non-empty string.

2. **Overly generic error messages**: The `onError` handler in `useWarehouseItems.ts` (line 325-343) only checks for specific constraint names but falls through to a generic "Failed to import items" message for other errors (RLS violations, data type mismatches, etc.). The actual Supabase error is only logged to console, not shown to the user.

3. **`undefined` fields not being cleaned**: When spreading parsed items, `undefined` values for optional fields like `barcode`, `sku`, `description` may behave differently depending on how Supabase serializes them.

## Changes

### 1. `BulkItemImportContent.tsx` — Clean data before insert

- Explicitly sanitize the data mapping on line 410: convert empty strings to `null` for `sku`, `barcode`, `description`, `brand`, `manufacturer`, `notes`, `image_url`
- Add CSV-internal SKU duplicate detection (similar to existing name duplicate detection)
- Add better error logging with `console.error` of the full error object

### 2. `useWarehouseItems.ts` — Improve error messages

- In the `onError` handler (line 325-343), include the raw `error.message` in the toast so users can see the actual database error
- Add handling for RLS policy violations (`row-level security`)

### 3. `BulkItemImportContent.tsx` — Add SKU uniqueness check against DB

- During the parsing/validation phase, check if any CSV row's SKU already exists in the database (similar to how item_code is checked on lines 339-349)
- Mark such rows as errors before attempting import

These are small, targeted fixes — no database changes needed.

