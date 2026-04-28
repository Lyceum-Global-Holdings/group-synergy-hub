
## Goal

When uploading stock via `BulkStockUploadDialog`, identify each row's catalog item by **either** `item_code` **or** `item_name` (case-insensitive, trimmed). Today only `item_code` is matched, so rows with only a name fail with "Item not found in Item Master".

## International standard being applied

GS1 / SAP MM / Oracle Inventory bulk-load convention:

- A **primary identifier** (item code / SKU / GTIN) is preferred and must win when both are present.
- A **secondary identifier** (item description / item name) is allowed as a fallback only when the primary is missing.
- Matching is **case-insensitive** and **whitespace-trimmed**.
- A name match must be **unique within the catalog scope** — if it resolves to >1 catalog item, reject the row as ambiguous so the user disambiguates with `item_code` (prevents silent mis-posting of stock, which is a hard SOX/inventory-audit rule).

So the resolution order per row:

```text
1. item_code present  → match by item_code (exact, case-insensitive)
2. else item_name present → match by name (case-insensitive)
       ├── 1 match  → use it
       ├── 0 match  → row error "Item not found"
       └── >1 match → row error "Ambiguous item name — please specify item_code"
3. neither present → row error "Provide item_code or item_name"
```

## What changes (frontend only — no DB changes)

### File: `src/components/warehouse/BulkStockUploadDialog.tsx`

1. **CSV template + header parsing**
   - Update both downloadable templates to: `item_code,item_name,quantity[,bin_code]` with a comment row example showing one row using only `item_code` and one row using only `item_name`.
   - On parse, accept any subset of `{item_code, item_name}` columns. Require at least one to be present in the header. `quantity` (and `bin_code` in per-row mode) remain required.

2. **Catalog lookup batches**
   - Keep the existing batched `IN (item_code, ...)` lookup for codes.
   - Add a parallel batched lookup for names: `warehouse_item_catalog` filtered by `status=active` and `name ILIKE ANY (...)` — but use a normalized client-side map (`name.toLowerCase().trim()` → `CatalogItem[]`) so we can detect duplicate names and flag ambiguity.
   - To avoid scanning the full catalog when many name-only rows exist, fetch by chunks of `name.in.(...)` (case-insensitive via `.ilike` per chunk OR a single `or=name.ilike.x,name.ilike.y` with PostgREST escaping). Use a single `select` with `.in('name', uniqueNames)` first (exact case match — covers the common case), then a fallback `.ilike` only for the unmatched remainder.

3. **Row resolution**
   - Replace the current `catalogMap.get(itemCode.toLowerCase())` block with the resolution order above.
   - Add two new statuses to `ParsedRow.status`: `'ambiguous_name'` (badge: amber, error: "Multiple items match this name; specify item_code") — keep `'item_not_found'` for the no-match case.
   - When a name-only row matches, fill `item_code` in the parsed row from the resolved catalog item so downstream import logic and the preview table both stay code-driven.

4. **Preview UI**
   - Show both `Item Code` and `Item Name` columns (already present); ensure `item_code` populates from the resolved catalog item for name-only rows so the user can verify the match before confirming.
   - Add a small badge "Matched by name" on rows that resolved via the name path so reviewers can audit.

5. **Help text**
   - Update the dialog description from "matched by item_code" to: *"Items are matched by **item_code** (preferred) or **item_name** (fallback). If a name matches multiple items, specify item_code instead."*

### Catalog-import additive flow stays the same

Once a row is resolved to a `catalog_item.id`, the existing additive logic (increment `current_stock`, upsert `warehouse_bin_allocations` on `(warehouse_item_id, bin_id, company_id)`) is unchanged. So uploading stock for an item that already lives in another bin still adds to the new bin without overwriting.

## What we explicitly do NOT change

- No DB migration. `warehouse_item_catalog.name` is not unique, and we will NOT add a unique constraint — name collisions are legitimate (different brands, sizes). We handle ambiguity at row-validation time instead.
- No change to `item_code` generation, RLS, company scoping, or the bin allocation uniqueness rule established in the previous change.
- `BulkStockUploadDialog` remains the only file edited.

## Acceptance criteria

1. CSV with only `item_code` column → continues to work exactly as today.
2. CSV with only `item_name` column → resolves rows by name; matched rows show the resolved `item_code` in the preview with a "Matched by name" badge; ambiguous names produce a clear row-level error.
3. CSV with both columns → `item_code` wins; `item_name` is ignored for matching but shown in preview for human verification.
4. CSV with neither column populated for a row → row error "Provide item_code or item_name".
5. Existing additive bin allocation behaviour (item across multiple bins/locations within a company) is preserved.
