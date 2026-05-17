## Goal
Let users paste both item codes and opening quantities (and optionally unit cost / notes) in one step from the "Bulk add from catalog" dialog on `/warehouse/inventory`, instead of only pasting codes and then editing qty per row.

## Solution
Extend the existing paste flow in `src/components/warehouse/bulk-catalog-import/` to accept tabular paste (Excel/Sheets-friendly TSV or CSV), so each line becomes one fully-populated row.

### Accepted paste formats
Auto-detect delimiter (`\t`, `,`, or `;`). Each line:

```
<code>      <opening_qty>   [unit_cost]   [notes]
ITM-001     50              12.50        Opening from FY26 audit
5012345678900  10
ITM-XYZ     0
```

- Column 1 (required): item code / GTIN / SKU
- Column 2 (optional): opening qty (number; blank or missing → 0)
- Column 3 (optional): unit cost
- Column 4 (optional): notes
- Single-column paste keeps working (qty defaults to 0) — fully backward compatible.
- Header row auto-skipped if first cell matches `/code|item|sku|gtin/i`.

Location and bin come from the dialog defaults (already in `useBulkCatalogImport`). If a row has qty > 0 but no default location/bin, it stays in the grid flagged invalid with the existing message ("Location required when qty > 0" / "Bin required when qty > 0") — user fixes inline before submit. This reuses the validator without backend changes.

### File changes (frontend only)
1. **`PasteCodesDialog.tsx`**
   - Update title/description to mention multi-column paste with example.
   - Change `onResolve` signature to pass parsed rows: `{ code: string; opening_qty?: number; unit_cost?: number; notes?: string }[]`.
   - Add a tiny parser: split lines, detect delimiter per line, trim cells, skip header, coerce numbers (ignore non-numeric qty → 0 with row warning).
   - Toast summary: "X matched · Y not found · Z with qty".

2. **`useBulkCatalogImport.ts`**
   - Rename/extend `seedFromCodes` → `seedFromPaste(entries)`. Same catalog lookup batched in one `.or(...)` query.
   - When building each `newRow`, pass `opening_qty`, `unit_cost`, `notes` from the entry; default `location_id` / `bin_id` from `defaultsRef`.
   - Keep `seedFromCodes` as a thin wrapper for any other caller (none today, but safe).

3. **`BulkCatalogToInventoryDialog.tsx`**
   - Wire the new resolver signature; no UI rework — same paste button.

### Out of scope
- No DB / RPC changes (`bulk_provision_inventory_from_catalog` already accepts `opening_qty`, `unit_cost`, `notes`).
- No new catalog creation flow (that's the separate Bulk Item Master).
- No bin auto-selection logic — bin still comes from the row default; qty>0 without a bin stays flagged.

### Validation
Manual: paste a 3-row TSV with mixed columns, confirm rows appear pre-filled, invalid rows surface inline, submit runs through the existing RPC.
