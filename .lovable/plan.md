## Problem

The "Assign to Bin" dropdown shows every bin twice (e.g. `1-B-2-1 - 1-B-2-1` appears two times in a row) and there is no search/quantity context, so users cannot tell which row to pick.

Root cause (verified in DB):

- `warehouse_bins` has **157 rows** but only **90 unique (bin_code, location_id)** combinations — **67 duplicate groups**.
- For every real bin there is a shadow row with `company_id = NULL` (legacy "global template" rows). The dropdown lists both.
- All **1,155 allocations live on the `company_id = NULL` rows**; the 68 `company_id`‑scoped duplicates are empty shells.
- There is no DB uniqueness on `(location_id, bin_code)`, and the UI label is just `bin_code - name` (which are identical), so duplicates are invisible to the eye.

International WMS practice (SAP EWM, Manhattan, Oracle WMS, GS1 Logistics Interoperability): a storage bin is a **single physical address** with one unique code inside its parent storage location, and pickers search/scan it with full breadcrumb + on‑hand qty.

## Plan

### 1. Database cleanup (migration)

1. **Re‑home the live bins to the correct sub‑location.** For every `company_id IS NULL` bin currently parked on the LFC root (`de0c4bd9…`) that should sit under VEB, move it to the VEB sub‑location id (`0630cfec…`). The existing parity trigger will cascade `warehouse_bin_allocations.location_id`. (Limited to the LFC→VEB set; other sites stay put.)
2. **Adopt the live bins into the company.** For each `company_id IS NULL` bin that has at least one allocation, set `company_id = '1c918a89…'` (NCG Warehouse Solutions). These are the real, in‑use bins.
3. **Delete the empty duplicate shells.** Remove the `company_id IS NOT NULL` rows whose `(bin_code, location_id)` now matches a freshly adopted bin and which carry zero allocations. Verified: 0 allocations point to them, so this is non‑destructive.
4. **Add uniqueness + index** to stop the problem coming back:
   - `CREATE UNIQUE INDEX warehouse_bins_code_per_location_uidx ON warehouse_bins (location_id, lower(bin_code)) WHERE deleted_at IS NULL;`
   - Keep the existing `enforce_bin_allocation_location_parity` trigger.
5. **Verification queries** (must all return 0 before commit):
   - duplicate `(bin_code, location_id)` groups
   - bins with `company_id IS NULL` that have allocations
   - allocations whose `location_id` ≠ `bins.location_id`

### 2. Bin picker UX (frontend only, no behaviour change to writes)

Replace the plain `<Select>` in `AddFromCatalogDialog`, `CreateItemDialog`, `SingleItemForm`, `AllocateToolToBinDialog` (and the scanned-bin adjust dialog) with a single reusable **`BinCombobox`** that follows international WMS picker conventions:

- **Searchable** (Command/Combobox) — type any part of bin code, aisle, bay, level, or location name.
- **Breadcrumb label**: `LFC › VEB · 1‑B‑2‑3` (storage type → section → bin) — matches SAP EWM `Warehouse / Storage Type / Section / Bin` display.
- **Secondary line per row**: current on‑hand for the item being placed (`12 pcs in this bin`) and bin capacity if set, dimmed when empty. Lets the picker pick the consolidating bin first (FIFO/consolidation rule).
- **Group by parent location** with sticky headers when the location filter is broad.
- **Dedupe defensively** by `id` and by `(location_id, lower(bin_code))` in the hook, so a stale cache cannot resurrect the duplicate display.
- **Recent bins** chip row (last 5 the user picked) for one‑tap re‑selection — standard in Manhattan / Blue Yonder pickers.
- **Empty state** with a "Create bin here" shortcut scoped to the selected sub‑location.
- Keyboard: ↑/↓ to move, Enter to pick, `/` to focus search — meets WCAG combobox pattern.

Hook change: in `useWarehouseBins`, return `bins` already deduped by id and sorted by `location_id, bin_code` using a stable natural sort (`1-B-2-2` before `1-B-2-10`).

### 3. Memory

Add a Core rule:

> Bin uniqueness: one bin per `(company_id, location_id, lower(bin_code))`, enforced by a unique index. Pickers must dedupe by id and display `Location › Sub‑location · BinCode` with on‑hand qty.

### Out of scope

No changes to FIFO, ledger, RLS, or write paths beyond the trigger already in place. No bin renaming. No location hierarchy changes other than the targeted LFC→VEB re‑home for the duplicate set.

### Files to touch

- New migration: dedupe + re‑home + unique index.
- New `src/components/warehouse/BinCombobox.tsx`.
- `src/hooks/useWarehouseBins.ts` — dedupe + natural sort.
- Swap `<Select>` for `<BinCombobox>` in `AddFromCatalogDialog.tsx`, `CreateItemDialog.tsx`, `SingleItemForm.tsx`, `AllocateToolToBinDialog.tsx`, scanned bin adjust dialog.
- `.lovable/memory/index.md` + new memory file `architecture/bin-uniqueness.md`.
