

## Add Bin Selection Mode to Bulk Stock Upload

### What Changes

Add a toggle in the upload dialog that lets the user choose between two modes:

1. **Single bin for all rows** — pick one bin from a dropdown; `bin_code` column in CSV becomes optional
2. **Per-row bin from CSV** — current behavior; `bin_code` column required in each row

### Implementation — `src/components/warehouse/BulkStockUploadDialog.tsx`

**1. New state & UI (before the CSV file input)**
- Add `binMode` state: `'single' | 'per-row'` (default `'per-row'`)
- Add `selectedBinId` state for the single-bin mode
- Fetch bins for the selected location using a query on `warehouse_bins` filtered by `effectiveLocationId`
- Render a toggle (two radio-style buttons or a Select) to choose the mode
- When `'single'` is selected, show a bin dropdown populated with active bins at the selected location

**2. Template download update**
- When `binMode === 'single'`, download a template with only `item_code,quantity` (no `bin_code` column)
- When `binMode === 'per-row'`, keep current template with `item_code,quantity,bin_code`

**3. Validation logic update (`handleFileUpload`)**
- When `binMode === 'single'`:
  - Skip requiring `bin_code` column in CSV headers
  - Skip bin lookup/matching — use `selectedBinId` for all rows
  - Set `bin_id` and `bin_code` on every parsed row from the selected bin
- When `binMode === 'per-row'`:
  - Keep existing logic unchanged

**4. Preview table**
- When `binMode === 'single'`, show the selected bin name in a badge above the table instead of per-row bin column (or show it in every row as the same value)

**5. Import logic (`handleImport`)**
- No changes needed — it already reads `row.bin_id` which will be set correctly in both modes

### Files Modified
- `src/components/warehouse/BulkStockUploadDialog.tsx` — all changes in this single file

