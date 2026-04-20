
## Fix bulk item code generation by correcting the actual import flow

### What I found
The current user-facing bulk upload flow is not using the code path that was fixed earlier.

1. `AddItemsDialog` renders `BulkItemImportContent` in the Bulk Import tab.
2. `BulkItemImportContent` still hard-requires `item_code` and never calls `allocateItemCodes`.
3. The previously updated `BulkItemImportDialog` is effectively a separate flow and is not the one the user is using here.
4. The current allocator reads from `warehouse_items`, but the active bulk importer writes to `warehouse_item_catalog`, so even if reused as-is it would validate against the wrong table.
5. There are now two parallel bulk import implementations, which is why single-item creation works but bulk upload still fails.

### Best solution
Implement one shared, standards-compliant item-code generation pipeline and apply it to the active bulk import flow.

This keeps item codes aligned with:
- GS1 deterministic SKU identification
- ISO 8000-110 master data quality
- ISO 7372 / SAP MM 3-letter material group mnemonic
- existing project standard: `INV-{CAT}-{NNN}`

### Implementation plan

#### 1) Refactor item code generation into a shared allocator
Update `src/utils/itemCodeGenerator.ts` so it supports both scopes:

- `catalog` scope: query `warehouse_item_catalog` for existing `INV-{CAT}-*` codes
- `inventory` scope: query `warehouse_items` scoped by `(company_id, item_code)`

Proposed shape:
```ts
allocateItemCodes({
  categoryCode,
  count,
  scope: 'catalog' | 'inventory',
  companyId?: string | null,
})
```

This ensures:
- global uniqueness for catalog imports
- company-scoped uniqueness for inventory imports
- one source of truth for all automated item-code generation

#### 2) Fix the active bulk importer
Update `src/components/warehouse/BulkItemImportContent.tsx` to make `item_code` optional.

Changes:
- blank `item_code` should mark the row for auto-generation
- require a valid top-level category/material group when auto-generating
- resolve the category’s 3-letter mnemonic
- allocate sequential codes per category group before duplicate checks
- show generated codes in preview with an “Auto” badge
- update the CSV template to leave `item_code` blank by default and explain the standard

#### 3) Make bulk import mode-aware so it matches single-item behavior
Pass `mode` from `AddItemsDialog` into `BulkItemImportContent`.

- In `catalog` mode:
  - create/update `warehouse_item_catalog`
  - use global code uniqueness
- In `inventory` mode:
  - follow the same architecture as `SingleItemForm`
  - create/reuse the catalog entry first
  - then create the company-scoped `warehouse_items` row
  - preserve selected company scoping

This is the safest fix because the user is on the inventory route, and bulk upload should behave consistently with single-item creation.

#### 4) Enforce standards-based category rules
For auto-generated codes:
- only allow Level 1 / top-level material groups
- reject rows where category is missing, unresolved, or lacks a valid 3-letter code
- keep manual `item_code` entry supported for exceptional imports

This keeps bulk import aligned with the existing single-item form and project memory.

#### 5) Remove drift between duplicate bulk flows
To prevent this from happening again:
- either consolidate the two bulk import components into one shared implementation
- or extract shared parsing/allocation/validation helpers used by both

Minimum safe outcome:
- the bulk flow rendered by `AddItemsDialog` must use the shared allocator and shared validation logic

### Files to update
- `src/components/warehouse/AddItemsDialog.tsx`
- `src/components/warehouse/BulkItemImportContent.tsx`
- `src/utils/itemCodeGenerator.ts`
- optionally `src/hooks/warehouse/useNextWarehouseItemCode.ts` to reuse the same shared logic

### Technical notes
- No database schema change is required
- No RLS change is required
- The fix is primarily a UI/import-pipeline consistency issue
- Existing manual item codes remain supported
- Duplicate checks must happen after auto-generated codes are assigned

### Verification
I would verify these cases after implementation:

1. Inventory bulk import with blank `item_code` generates `INV-{CAT}-{NNN}` successfully
2. Catalog bulk import with blank `item_code` also generates codes successfully
3. Multiple rows in the same category get sequential codes
4. Mixed categories generate separate sequences
5. Missing category + blank code gives a clear validation error
6. Existing manual code duplicates are blocked correctly
7. Imported bulk items appear in the same places and with the same code logic as single-item creation

### Expected outcome
Bulk upload will finally behave like single-item creation: item codes auto-generate reliably, follow international standards, and stay consistent across catalog and inventory workflows.
