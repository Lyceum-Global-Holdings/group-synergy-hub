

# Bulk Item Master Upload with Duplicate Filtering and Item Code Updates

## Problem

The existing warehouse bulk import rejects items when their `item_code` already exists in the database. There is no filtering by item name, and no way to update the `item_code` of an existing item during import.

## Solution

Enhance `BulkItemImportContent.tsx` to support three import modes for each row:

1. **New Item** -- item name does not exist in DB, insert as new
2. **Skip (Duplicate)** -- item name already exists, skip automatically
3. **Update Item Code** -- item name exists but CSV has a different `item_code`, offer to update it

## How It Works

During CSV parsing, each row is matched against existing items **by name** (case-insensitive, within the same company):

- **No match by name**: Treat as a new item (current behavior)
- **Match by name, same item_code**: Mark as "Duplicate - Skip" with a visual indicator
- **Match by name, different item_code**: Mark as "Update Item Code" candidate, showing old code vs new code, with a checkbox to opt-in to the update

## Changes

### `BulkItemImportContent.tsx` -- Major Enhancement

1. **Name-based duplicate detection** during parsing:
   - Compare each CSV row's `name` against `existingItems` (case-insensitive, same company)
   - Categorize each row as `new`, `duplicate`, or `update_code`

2. **Preview table enhancements**:
   - Add a "Status" column showing: New (green), Duplicate-Skip (gray), Update Code (amber)
   - For "Update Code" rows, show old item_code -> new item_code with a toggle to include/exclude
   - Summary bar: "X new items, Y duplicates skipped, Z item codes to update"

3. **Import logic update**:
   - Insert only `new` items (filter out duplicates)
   - For `update_code` items that are toggled on, run `supabase.from('warehouse_items').update({ item_code }).eq('id', existingId)`
   - Show final result: "X items created, Y item codes updated, Z duplicates skipped"

4. **Also filter duplicates within the CSV itself** by name (not just item_code as currently done)

### No database changes needed

The `warehouse_items` table already has `name` and `item_code` columns. Updates use the existing update capability.

## UI Flow

```text
Upload CSV
    ↓
Parse & match by name against DB
    ↓
Preview table with 3 row types:
  [NEW]         Item A  |  ITEM-001  |  ready to import
  [DUPLICATE]   Item B  |  ITEM-002  |  skipped (already exists)
  [UPDATE CODE] Item C  |  ITEM-003 → ITEM-099  |  ☑ update
    ↓
Click Import
    ↓
Insert new items + update selected item codes
```

