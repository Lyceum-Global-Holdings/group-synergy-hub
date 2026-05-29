## Goal
Add a "Paste items" capability to the Create Stock Transfer dialog so users can bulk-add transfer lines from a spreadsheet (Excel/Google Sheets) instead of picking + typing each row.

## International standards reference
- GS1 Logistics Interoperability Model (LIM) & EDIFACT INVRPT/INSDES line structure: each transfer line is `{ item identifier, quantity, [uom] }`.
- SAP S/4 MIGO and Oracle WMS "Mass entry" patterns: TSV/CSV paste with item code as primary key, GTIN/SKU as fallback, UoM optional (defaults to base UoM), quantity validated against source on-hand.
- Aligns with the project's existing bulk-paste convention used in `BulkCatalogToInventoryDialog` (paste-codes dialog + direct TSV paste, resolves via `warehouse_item_catalog` by `item_code` → `barcode` → `sku`).

## UX
Add a `Paste items` button next to the existing `Select item / Quantity / +` row inside the "Transfer Items" section. Clicking opens a small sub-dialog:

```text
┌─ Paste transfer items ───────────────────────────┐
│ One line per item. Tab/comma/semicolon separated:│
│   <item_code>  <quantity>  [uom]                 │
│                                                  │
│ [ large monospace textarea ]                     │
│                                                  │
│ Source bin: <current From Bin>                   │
│ [ Preview ]                                      │
│                                                  │
│ Preview table:                                    │
│  Code  Item     Qty   UoM   On-hand  Status      │
│  IT-01 Bolt M8  50    pcs   240      OK          │
│  IT-09 ?        10    -     -        Not found   │
│  IT-02 Nut M8   500   pcs   120      Over stock  │
│                                                  │
│ [Cancel]                       [Add 2 valid rows]│
└──────────────────────────────────────────────────┘
```

- Accepts TSV (Excel default), CSV, and semicolon-separated. Trims, ignores blank lines, dedupes by `item_code` (sums quantity with a "merged N duplicates" note).
- Resolves codes against catalog in this order: `item_code` → `barcode/GTIN` → `sku` (same resolver used in bulk catalog import — reused, not duplicated).
- Quantity validated: number > 0, ≤ on-hand at the selected From Bin (warns, does not block — matches existing single-row add behavior).
- UoM optional; if omitted, falls back to the item's base UoM. If provided and doesn't match base UoM, row is flagged (non-blocking warning).
- Preview surfaces three states per row: `OK`, `Warning` (over-stock / uom mismatch / duplicate-merged), `Error` (not found / qty invalid). Only `OK` + `Warning` rows are imported; `Error` rows stay in the textarea highlighted so the user can fix and re-preview.
- "Add N valid rows" appends to the existing `transferItems` state — same shape as `handleAddItem` already produces, so downstream submit logic is unchanged.

## Discoverability touches
- Small helper text under the Transfer Items header: `Tip: paste from Excel — code, qty, uom`.
- The paste dialog shows a one-line example and a "Download template" link emitting a 3-column CSV (`item_code,quantity,uom`).

## Files (frontend only)
- `src/components/warehouse/CreateStockTransferDialog.tsx` — add `Paste items` button, wire to new dialog, merge result into `transferItems`.
- `src/components/warehouse/stock-transfer/PasteTransferItemsDialog.tsx` — new component: textarea, parser, preview table, validation, confirm.
- `src/components/warehouse/stock-transfer/pasteParser.ts` — pure parser + resolver helpers (TSV/CSV/semicolon, dedupe, code→catalog lookup via existing `warehouse_item_catalog` query). Unit-testable.

## Out of scope
- No backend / RPC changes (existing per-item `createItem` mutation handles the appended rows).
- No change to the single-row add, bin selectors, or submit flow.
- No barcode scanner integration in this iteration (paste only); the resolver already accepts GTIN so a future scanner add is a one-line change.
