
Fix the re-import flow by treating “removed from inventory” items as inactive inventory rows to be reactivated, not as brand-new inserts.

What I found:
- The catalog item for “Scapel Blade” still exists in `warehouse_item_catalog`.
- There is no active inventory row for it right now.
- The current import dialog only hides rows with `current_stock > 0`, which is correct.
- But on import, it always does a fresh `insert` into `warehouse_items`.
- `warehouse_items` has a unique constraint on `(item_code, company_id)`, so if a zero-stock row still exists for that company, the insert fails even though the item is no longer visible in Inventory.
- This explains why removed items can’t be imported again.

Best solution:
1. Keep the existing catalog item.
2. When importing from catalog, first look for an existing company inventory row for the same `catalog_item_id` or same `item_code`.
3. If found, reactivate/update that row instead of inserting a new one:
   - set `current_stock` to the new quantity
   - set `status` to `active`
   - refresh copied fields from the catalog if needed
4. Recreate the bin allocation for that restored row.
5. Only do a fresh insert when no prior inventory row exists.

Files to update:
- `src/components/warehouse/AddFromCatalogDialog.tsx`
  - Change import mutation from “always insert” to “restore-or-insert”.
  - Query existing `warehouse_items` for the selected company and selected catalog item before insert.
- Optional improvement:
  - Update the helper query that builds `existingCatalogIds` to exclude only truly active/in-stock rows, while restored zero-stock rows remain importable until reactivated.

Implementation approach:
- In `mutationFn`:
  - fetch existing row for `selectedCompany.id` + `selectedItem.id`
  - if row exists:
    - `update warehouse_items set current_stock = quantity, status = 'active', ...copied catalog fields`
    - use existing row id for allocation
  - else:
    - perform the current insert path
- Then create bin allocation against the resolved inventory row id.
- Invalidate the same inventory/allocation queries afterward.

Why this is the best fix:
- Matches the intended architecture: one catalog item, one company inventory row.
- Avoids duplicate rows for the same item/company.
- Respects the existing unique constraint instead of fighting it.
- Makes re-import behave like “restore to inventory”, which is what users expect.

Technical note:
- Matching by `catalog_item_id` should be primary.
- Fallback matching by `(company_id, item_code)` is useful for older rows created before the catalog link was always enforced.
- If multiple legacy zero-stock duplicates exist, prefer the newest row and note cleanup as a follow-up.

Validation after implementation:
- Remove “Scapel Blade” from inventory.
- Open Import from Catalog.
- Confirm “Scapel Blade” appears.
- Re-import it with quantity and bin.
- Verify it returns to Inventory without creating a duplicate row.
