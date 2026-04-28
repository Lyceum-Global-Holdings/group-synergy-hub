
## Goal

Allow the **same catalog item** to live in:
- multiple **bins** within the same location, AND
- multiple **locations** within the same company, AND
- multiple **companies** (each company keeps its own inventory),

without changing or migrating any existing bin allocation rows.

## International standard being applied

This follows the standard WMS / SAP EWM / Oracle WMS pattern:

```text
Catalog Item (global master, 1 row)
        │
        │ 1 : N  (one inventory row per company)
        ▼
Warehouse Item   (company-scoped on-hand record)
        │
        │ 1 : N  (one allocation per bin)
        ▼
Bin Allocation   (item × bin × company, qty + reserved)
        │
        ▼
Bin → Location → Company   (physical hierarchy)
```

Key invariants (already supported by the schema, just under-used by the UI):

- `warehouse_items` is **company-scoped** (`company_id` column) → same catalog item naturally creates **one row per company**.
- `warehouse_bin_allocations` unique key is `(warehouse_item_id, bin_id, company_id)` → same item can have **many bin allocations across many bins/locations** in the same company.
- Bins already belong to a location, so "different locations same company" is just "allocations against bins in different locations".

So the database already supports the international standard. **No schema migration is needed.** The fix is in the UI/import logic, which today incorrectly treats a catalog item as "already imported" if any allocation exists, and refuses to add it to an additional bin/location.

## What changes (frontend only)

### 1. `src/components/warehouse/AddFromCatalogDialog.tsx`

Currently the dialog:
- hides catalog items that already have a `warehouse_items` row in the current company (`existingCatalogIds` filter), and
- on import, looks up the existing `warehouse_items` row and **overwrites** `current_stock` with the new qty.

Change it to support "add to another bin / another location":

- **Stop hiding** catalog items that already exist in the current company. Instead, show a small badge ("Already in inventory — adding to another bin") next to those rows so the user knows.
- On import:
  - If a `warehouse_items` row already exists for this `(company_id, catalog_item_id)`:
    - **Do not overwrite `current_stock`.** Increment it: `current_stock = current_stock + qty`.
    - Reuse its `id` as `itemId`.
  - If no row exists, insert a new `warehouse_items` row with `current_stock = qty` (existing path).
  - Then upsert the bin allocation on the unique key `(warehouse_item_id, bin_id, company_id)`:
    - If allocation exists → `allocated_quantity = allocated_quantity + qty`.
    - If not → insert a new allocation row with `allocated_quantity = qty`.
- This makes the same item available in N bins / N locations within the company, and `current_stock` stays equal to `SUM(allocated_quantity)` per item.

### 2. `src/components/warehouse/SingleItemForm.tsx` (Add Item dialog)

Apply the same "additive" behavior so manually adding an item that already exists in the company appends to a new bin instead of erroring on the unique constraint.

- Detect existing `warehouse_items` row for `(company_id, item_code)` → reuse its id and increment `current_stock`.
- Use upsert / increment on `warehouse_bin_allocations` keyed by `(warehouse_item_id, bin_id, company_id)`.

### 3. Cross-company behavior

No code change required: each company's inventory is a separate `warehouse_items` row keyed by `company_id`, and bin allocations are also `company_id`-scoped. Importing the same catalog item under a different `selectedCompany` already creates an independent inventory + bin allocation chain.

### 4. UX touches

- In the bin allocation list / Item Bin Master, when an item appears in multiple bins, show all rows grouped by item with sub-rows per bin (already the table structure — just confirm no client-side dedupe by `warehouse_item_id`).
- On the catalog import dialog, replace the current "already imported, hidden" behavior with an inline note: *"Already in inventory in {company}. Importing again will add stock to the selected bin."*

## What we explicitly do NOT change

- No DB migration. Existing unique constraint `unique_item_bin_company (warehouse_item_id, bin_id, company_id)` is exactly the international standard — keep it.
- No edits to existing `warehouse_bin_allocations` rows or quantities.
- No change to RLS, company scoping, or the `available_quantity` generated column.
- No change to `warehouse_item_catalog` (global master stays as the single source of truth).

## Files to edit

- `src/components/warehouse/AddFromCatalogDialog.tsx` — remove "already imported" hide; switch import to additive (increment stock + upsert allocation).
- `src/components/warehouse/SingleItemForm.tsx` — additive create when item already exists in company; upsert allocation by `(warehouse_item_id, bin_id, company_id)`.
- (Verification only) `src/pages/warehouse/ItemBinMaster.tsx` and any list hooks — confirm no client-side dedupe collapses multi-bin rows.

## Acceptance criteria

1. Same catalog item can be imported into Bin A and Bin B of the same location → 1 `warehouse_items` row, 2 `warehouse_bin_allocations` rows, `current_stock = qtyA + qtyB`.
2. Same catalog item can be imported into bins in two different locations of the same company → still 1 `warehouse_items` row, N allocations across locations.
3. Same catalog item imported in Company X and Company Y → 2 independent `warehouse_items` rows (one per company), each with its own allocations.
4. No existing bin allocation row is modified or deleted by this change.
