

# Make Bin Master Common Across All Companies

## Problem

Bins are currently scoped per company (`company_id` column + unique constraint on `(bin_code, company_id)`). This causes duplicate bins when multiple companies use the same warehouse locations. Bins should be shared — they represent physical storage locations, not company-specific resources.

## Solution

Bins are already tied to `location_id` (warehouse locations), which are shared across companies via the `warehouse_location_companies` junction table. We make bins **location-scoped instead of company-scoped**.

## Database Changes

1. **Drop** the unique constraint `warehouse_bins_bin_code_company_id_key`
2. **Add** a new unique constraint `warehouse_bins_bin_code_location_id_key` on `(bin_code, location_id)` — prevents duplicate bin codes within the same location
3. **Set** `company_id = NULL` on all existing bins (optional cleanup, keeps backward compat)

## Code Changes

### `useWarehouseBins.ts`
- **Remove company filtering** from the query — fetch all bins regardless of selected company (like Item Master Definition does with `skipCompanyFilter`)
- **Remove `company_id` assignment** in `createBinMutation` — bins no longer belong to a company
- Keep location-based permission filtering (already in place)

### `BinMasterTab.tsx`
- **Remove** the `isViewingAllCompanies` disabled state on the "Add Bin" button — bins can be created regardless of company selection
- **Remove** the "Viewing bins from all companies" alert
- **Add** a note: "Bins are shared across all companies and scoped by location"

### `CreateBinDialog.tsx`
- **Make location mandatory** — since bins are no longer company-scoped, location becomes the primary grouping. Require `location_id` before saving.

### `BinAllocationsTab.tsx` (no changes expected)
- Bin allocations already have their own `company_id` for multi-tenant scoping of stock — this remains unchanged. The bin itself is shared, but the stock allocated in it is company-specific.

## Data Integrity

- `warehouse_bin_allocations` keeps its own `company_id` — stock ownership remains company-scoped
- The bin is just a physical container; which company's items are in it is tracked at the allocation level
- Existing references (`bin_id` foreign keys) remain valid — no data migration needed

