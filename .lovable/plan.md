# Fix: Bulk catalog import — default Location/Company from global selection

## Problem

In `BulkCatalogToInventoryDialog`, the Company dropdown *displays* the active company via a fallback (`row.company_id ?? defaultCompanyId`) but the row's actual `company_id` stays `null`. Location is never pre-filled at all. Validation requires real values on the row:

- `!r.company_id` → "Company required"
- `qty > 0 && !r.location_id` → "Location required when qty > 0"

So every row shows defaults visually, but is marked **Invalid** and the Import button stays disabled / nothing gets added. The user expects the row's Location to mirror the location chosen in the global header dropdown (`LocationFilterContext.globalLocationId`), same as the rest of the warehouse pages.

## Solution

Persist the global Company + Location into each row's state (not just as a display fallback), and keep them in sync when the user changes the global selectors or adds rows.

### Files to change (frontend only)

1. **`src/components/warehouse/bulk-catalog-import/useBulkCatalogImport.ts`**
   - Accept `defaults: { company_id, location_id }` as a hook arg.
   - `newRow()` seeded with these defaults.
   - Initial state uses defaults.
   - `seedFromCodes` and any new-row creation use defaults.
   - `useEffect` backfills `company_id` / `location_id` on existing rows that are still blank when defaults change (don't overwrite user-edited values or imported rows).

2. **`src/components/warehouse/bulk-catalog-import/BulkCatalogToInventoryDialog.tsx`**
   - Pull `globalLocationId` from `useLocationFilter()` and `selectedCompany` from `useCompany()`.
   - Pass `{ company_id: selectedCompany?.id, location_id: globalLocationId }` to the hook.
   - Remove the cosmetic `row.company_id ?? defaultCompanyId` fallback — the row now holds the real value.
   - When user picks a Company on a row, default `location_id` to `globalLocationId` if that location belongs to the chosen company (else clear).

3. **`src/components/warehouse/bulk-catalog-import/types.ts`** (if needed)
   - `newRow(overrides)` already accepts overrides — extend default factory to take a `defaults` arg.

### Validation / UX

- A small info chip above the grid: "Defaults: {Company} · {Location ?? 'All locations'}" with a "Clear defaults on rows" button (clears only blank/pending rows) — makes the auto-fill visible and reversible.
- If `globalLocationId` is null, only `company_id` is auto-filled; user picks location per row as today.
- Bin remains optional and gated by location.

### Out of scope

- No backend / RPC changes. The `bulk_provision_inventory_from_catalog` RPC and RLS are unchanged.
- No change to catalog picker or paste-to-resolve flow beyond inheriting the defaults.

### Expected result

Opening the "Bulk add from catalog" dialog with a company + location selected in the header pre-fills every row → rows go straight to **Valid** once an item and qty are picked → "Import N rows" works and items appear in inventory.
