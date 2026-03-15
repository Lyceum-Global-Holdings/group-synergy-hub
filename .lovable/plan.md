# Fix: Duplicate Key Violation on `warehouse_items_item_code_company_id_key`

## Root Cause

The unique constraint is `(item_code, company_id)` — per-company uniqueness. But the validation logic at line 354 checks item_code against **all items globally** (`allExistingItems`). This causes two problems:

1. **New items incorrectly blocked**: An item_code that exists in company A is wrongly rejected when importing into company B.
2. **Code updates not validated**: When updating an existing item's code (`update_code` path), there's no check whether the new code already exists within that item's company, leading to the DB constraint violation.

## Changes

### `src/components/warehouse/BulkItemImportContent.tsx`

1. **For new items** (line 354): Check item_code uniqueness only against items in the **target company** (`selectedCompany`), not globally. Filter `allExistingItems` to only those matching `selectedCompany?.id`.
2. **For `update_code` items** (line 377-383): Add a validation check — if the new `item_code` already exists for the same `company_id` as the existing item, mark it as an error instead of `update_code`.
3. **SKU check** (line 365): Similarly scope to the target company if needed, though SKU may be globally unique — will preserve current global check.