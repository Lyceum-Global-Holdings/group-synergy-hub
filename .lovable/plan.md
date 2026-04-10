

## Fix: All Users See All Locations When Decreasing Stock (Location → Sub-Location Hierarchy)

### Problem
The `StockAdjustmentDialog` calls `useWarehouseBins()` **without** `skipLocationFilter`, so non-admin users only see bins within their permitted locations when decreasing stock. The sub-location dropdown is also limited to project-allocated sub-locations only.

Per **ISO 55001** (Asset Management) and **APICS/ASCM** best practices, stock consumption/issue operations should provide visibility into all storage locations to ensure accurate demand fulfillment and prevent artificial shortages caused by access restrictions. Write authorization remains enforced at the backend level (RLS + approval workflows).

### Solution

**Principle**: Separate **visibility** (read) from **authorization** (write) — the same pattern already used for transfers (`skipLocationFilter: true`).

### Changes

**1. `StockAdjustmentDialog.tsx` — Pass `skipLocationFilter` for decrease operations**

- Change `useWarehouseBins()` call to `useWarehouseBins({ skipLocationFilter: true })` so all bins across all locations are visible during stock adjustments.
- This mirrors the existing transfer pattern and is consistent with the project's established "visibility-agnostic" architecture for operational efficiency.

**2. `StockAdjustmentDialog.tsx` — Add Location → Sub-Location hierarchical selector**

Replace the flat sub-location dropdown with a two-step hierarchy:
- **Step 1**: Select a **Location** (parent) from all `warehouse_locations` where `type = 'location'`
- **Step 2**: Select a **Sub-Location** (child) filtered by the selected parent's `id`

This gives users a clear Location → Sub-Location navigation path instead of a flat list.

**3. `StockAdjustmentDialog.tsx` — Show all warehouse sub-locations (not just project-allocated ones)**

Currently the sub-location list comes from `useProjectStorageLocations`, which only returns sub-locations linked to construction projects. Replace this with a direct query to `warehouse_locations` filtered by `type = 'sublocation'` and the selected parent location, so **all** sub-locations are visible regardless of project allocation.

**4. Bin selector — Group bins by location**

Update the bin dropdown to display bins grouped by their parent location name, making it easier for users to identify where stock is being decreased from across all locations.

### Files Modified
| File | Change |
|------|--------|
| `src/components/warehouse/StockAdjustmentDialog.tsx` | Add `skipLocationFilter: true`, replace flat sub-location list with Location → Sub-Location hierarchy, group bins by location |

### Standards Alignment
| Standard | Application |
|----------|------------|
| ISO 55001 | Full asset visibility for consumption operations |
| APICS/ASCM | Unrestricted location visibility for stock issue/adjustment |
| ISO 29119 | Existing test environment can validate this change |

### Safety
- **Read visibility only** — all users can see all locations in the decrease dialog
- **Write authorization unchanged** — RLS policies and backend guards still enforce company-scoped write permissions
- Matches the existing `skipLocationFilter` pattern already approved for transfers

