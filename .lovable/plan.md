## Goal
When a row's item code already exists in the catalog, let the user choose how to handle the conflict in the **Bulk create items** dialog. Today every duplicate is hard-flagged as `invalid` ("Item code already exists in the catalog"), forcing the user to delete/rename rows manually.

## New toolbar control
Add a small **"On duplicate code"** Select to the dialog toolbar (next to *Reset*) with three options:

- **Fail** (default — current behavior). Row → `invalid`. Nothing inserted.
- **Skip**. Row → new `skipped` status. Row is not submitted but stays visible with a "Skipped — code already exists" tag. Excluded from the create count.
- **Update**. Row → `valid` (with a warning "Will update existing item"). On submit, the row PATCHes the existing catalog item by id instead of inserting.

Policy applies to **catalog-collision** errors only. In-batch duplicates (same code typed twice in the grid) remain a hard `invalid` regardless of policy.

## Changes (frontend only, 3 files)

### 1. `src/components/warehouse/bulk-item-master/types.ts`
- Extend `BulkItemRowStatus` with `'skipped' | 'updated'`.
- Add `existing_catalog_id?: string | null` to `BulkItemMasterRow` (set during `recompute` when the code matches an existing catalog row; used by submit for the update path).

### 2. `src/components/warehouse/bulk-item-master/useBulkItemMaster.ts`
- Add `duplicatePolicy: 'fail' | 'skip' | 'update'` state (default `'fail'`) and a `setDuplicatePolicy` setter; expose both on the return.
- Replace `existingCodes: Set<string>` with `existingCodeToId: Map<string, string>` so we can resolve the target id for updates.
- In `recompute`, when `existingCodeToId.has(lower)`:
  - set `next.existing_catalog_id = existingCodeToId.get(lower)`;
  - branch by `duplicatePolicy`:
    - `fail` → push current error (unchanged).
    - `skip` → warning + force `status = 'skipped'` (skip the valid/invalid assignment).
    - `update` → warning "Will update existing item" + allow `status = 'valid'` to be computed from remaining errors.
- In `submit`:
  - Partition `valid` rows into `creates` (no `existing_catalog_id`) and `updates` (have it).
  - Creates: existing `bulkCreateItemsAsync` path (unchanged).
  - Updates: `Promise.all` on `updateItemAsync({ id, name, description, brand, category_id, unit_id })` — do **not** change `item_code` (it's the match key).
  - On success mark create rows `imported` and update rows `updated`.
  - Toast summary: `"Imported X, updated Y"` (omit zero counts).
- `validCount` continues to count rows that will act (creates + updates). Add `skippedCount` for the toolbar chip.
- Expose `duplicatePolicy`, `setDuplicatePolicy`, `skippedCount`.

### 3. `src/hooks/useWarehouseItemCatalog.ts`
- Add `updateItemAsync: updateMutation.mutateAsync` to the return (mirrors existing `updateItem`). Tiny additive change — no behavior shift.

### 4. `src/components/warehouse/bulk-item-master/BulkItemMasterDialog.tsx`
- Add a labeled `<Select>` ("On duplicate code: Fail / Skip / Update") in the toolbar bound to `duplicatePolicy`.
- Status badges: add **Skipped** (secondary) and **Updated** (outline + success colour, mirroring "Imported"). Treat them as terminal/disabled rows like `imported`.
- Submit button label: `Process N item(s)` when policy is `update` or `skip` (since "Create" is no longer accurate); keep `Create N item(s)` when policy is `fail`.
- Toolbar chip: show `{skippedCount} skipped` when > 0.

## Out of scope
- No DB migration, no RPC change, no schema change.
- Bulk PATCH endpoint is not introduced — updates run as parallel single-row PATCHes (typical N for bulk import is small, and the existing `updateMutation` already handles auth/invalidations).
- In-batch dedupe rules are unchanged.
- Excel-paste/classifier behavior untouched.
