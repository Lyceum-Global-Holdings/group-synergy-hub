## Goal

In "Bulk add from catalog", allow the same catalog item to be placed into **multiple bins inside the same warehouse/location** in a single import — the standard WMS pattern (SAP EWM Putaway Split, Oracle WMS Multi-Bin Receipt, Manhattan WMS Lot Split). Today the grid technically allows this only if the user manually re-adds the item as a separate row and re-picks company/location/bin — there's no first-class "split across bins" affordance, and no fast way to enter several bin/qty pairs for one item.

## Current behaviour (verified)

- `bulk_provision_inventory_from_catalog` RPC already accepts one row = one (item, company, location, bin, qty) tuple and upserts the `warehouse_bin_allocations` row, so multi-bin placement IS supported at the data layer.
- Frontend dedupe key is `(catalog_item_id, company_id, location_id, bin_id)` — different bins for the same item/location are NOT flagged as duplicates.
- What's missing is UX: users have to add N separate rows, re-pick the item + company + location N times, and remember to vary only the bin.

## What to build

### 1. Per-row "Split across bins" expansion (frontend only)

Add an optional `allocations[]` mode to each grid row. Default stays single-line (back-compat). A new row action **"Split across bins"** expands the row into sub-lines under the same item:

```text
#  Item              UoM  Company   Location        Bin     Qty   Cost   …
12 ITM-0042 — Bolt   PCS  ACME      WH-01 / Zone A  ─       ─     ─        [+ Split]
   └─ split 1                                       A-01-03  40   1.20
   └─ split 2                                       A-02-07  60   1.20
   └─ split 3                                       B-04-01  25   1.25
                                                    [+ Add bin]
```

Rules:
- Splits inherit Item / Company / Location from the parent; user only picks **Bin + Qty + (optional) Unit Cost / Reorder**.
- Bin picker uses the existing `useBinsAtLocation` (exact-node parity preserved).
- Intra-row dedupe: same `bin_id` twice inside one item → "Duplicate bin in split" invalid.
- Cross-row dedupe key stays `(item, company, location, bin)` — flattened across all splits.
- Header qty/cost on the parent are hidden when in split mode; a read-only "Σ qty" summary shows total.
- Toolbar gets **"Duplicate row to new bin"** as a one-click alternative for users who prefer one-row-per-bin.

### 2. Submit payload flattening

`useBulkCatalogImport.submit()` flattens each row's splits into the existing per-allocation payload the RPC already accepts — **no RPC change required**. Each split becomes one element in `p_rows`:

```ts
{ catalog_item_id, company_id, location_id, bin_id: split.bin_id,
  opening_qty: split.qty, unit_cost: split.unit_cost ?? row.unit_cost,
  reorder_level: row.reorder_level, reference_no, notes }
```

Result mapping: the RPC returns one result per payload element; map results back to `(rowId, splitId)` so each sub-line gets its own Imported / Error badge.

### 3. Paste / TSV ergonomics

Extend the grid-paste parser to accept an optional 5th column = bin code:

```
ITM-0042   40   1.20   PO-123   A-01-03
ITM-0042   60   1.20   PO-123   A-02-07
ITM-0042   25   1.25   PO-123   B-04-01
```

Lines that share `(code, company default, location default)` and differ only in bin auto-collapse into one parent row with multiple splits (still resolvable to flat rows if the user prefers).

### 4. Validation updates

`validateRow` becomes `validateRowOrSplit`:
- Parent without splits → unchanged single-line rules.
- Parent with splits → require ≥1 split; each split must have bin + qty > 0; bin must belong to the parent's location (server still re-validates); sum of split qty > 0.

## Out of scope

- No schema migration, no RPC change — the DB already enforces bin/location parity and per-allocation upsert.
- No change to single-bin flows elsewhere (GRN, Putaway, Add Stock).
- Catalog creation stays out of this dialog.

## Technical notes

- Files touched (frontend only):
  - `src/components/warehouse/bulk-catalog-import/types.ts` — add `BulkCatalogSplit` and optional `splits?: BulkCatalogSplit[]` on `BulkCatalogRow`.
  - `src/components/warehouse/bulk-catalog-import/useBulkCatalogImport.ts` — split-aware validation, dedupe across flattened tuples, payload flattening, result fan-out.
  - `src/components/warehouse/bulk-catalog-import/BulkCatalogToInventoryDialog.tsx` — render parent + split sub-rows, "Split across bins" / "Add bin" / "Duplicate row to new bin" actions, sum badge.
  - TSV paste parser in the dialog — accept optional bin column and auto-group.
- Reuses `useBinsAtLocation` (exact-node, no ancestor inheritance) per existing `bin-allocation-location-parity` rule.
- No memory update needed — behaviour is consistent with `architecture/warehouse-bin-allocation-uniqueness` (one allocation row per item+bin+company+location; multiple bins per item is explicitly allowed).
