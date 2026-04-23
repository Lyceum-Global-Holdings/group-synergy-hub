

## Fix Inventory tab so it strictly respects the selected location

### Exact issue (verified)

`src/hooks/useWarehouseItemsLazyInventory.ts` accepts `locationId` but only uses it to scope **bin enrichment**. The `warehouse_items` query itself is never filtered by location, so:

- Selecting any sub-location (e.g. `Lyceum…`) under company `NCG Warehouse Solutions` still returns every NCG item, regardless of where its stock physically sits.
- 236 / 975 stock-bearing items have `location_id = NULL`. Even if we naively add `.eq('location_id', x)`, items whose presence at a location is expressed only through bin allocations (NULL `location_id` on the item) would disappear or leak depending on how it's written.

This breaks the multi-tenant standalone-warehouse model: a company picking a sub-location must see only its own items physically present at that sub-location.

### International standard being applied

- **SAP EWM**: stock visibility is always scoped to the storage location (warehouse number / storage type) currently in context — never the whole plant.
- **GS1 GLN / ISO 6523**: each physical location is its own identity; queries must resolve at the chosen node, not its parent.
- **ISO 8000**: one canonical resolver — reuse the existing `get_company_inventory_at_location` RPC; do not invent a parallel filter.
- **ISO/IEC 27001 A.9**: company + location scoping enforced on the server.

### Solution — single canonical path

When the user has selected BOTH a company AND a location, route the Inventory tab through the already-deployed canonical RPC:

```
get_company_inventory_at_location(p_company_id, p_location_id)
```

This RPC already enforces per-company isolation at a physical node, including standalone sub-locations.

When NO location is selected (header shows "All Locations"), keep the current paginated `warehouse_items` query (company-scoped), unchanged.

### Changes

#### 1) `supabase/migrations/<new>.sql`

Extend `get_company_inventory_at_location` to:

- Include items that are physically at the location through **either**:
  - `warehouse_items.location_id = p_location_id`, OR
  - the item has a bin allocation in a `warehouse_bins` row whose `location_id = p_location_id` (covers items with NULL `location_id` whose presence is expressed via bins).
- Strictly require `warehouse_items.company_id = p_company_id` (no leakage across tenants sharing the same physical sub-location).
- Filter `current_stock > 0`.
- Order by `created_at desc, id desc` to match existing pagination ordering.
- Return the same column set as `warehouse_items` plus joined supplier name, so the frontend mapper does not change.

This keeps one server-side source of truth for "what is company X's inventory at location Y".

#### 2) `src/hooks/useWarehouseItemsLazyInventory.ts`

- When `locationId` is set AND `selectedCompany?.id` is set AND `!isViewingAllCompanies`:
  - Switch to a single-page query backed by `get_company_inventory_at_location`. Inventory at one physical node is bounded and does not need cursor pagination; cap defensively at `MAX_ITEMS`.
  - Apply the existing search / category / status / supplier filters client-side over the returned set (small N) to keep the UX identical.
  - Run the existing bin enrichment scoped to that single `location_id`.
- When `locationId` is null OR `isViewingAllCompanies`:
  - Keep the current cursor-paginated path exactly as today.
- Include `locationId` in the React Query key (already present) so switching locations refetches.

#### 3) Bin filter dropdown in `ItemMasterTab`

- The "All Bins" dropdown must list only bins belonging to the selected `globalLocationId` when one is selected. (Currently bins are scoped only by permissions.) Pass `globalLocationId` to the bin source so the dropdown matches the inventory result.

#### 4) Empty state

When a location is selected and the company has zero inventory there, show an explicit "No inventory for {Company} at {Location}" message instead of the generic empty table — consistent with the LocationSelector UX standard set in the prior plan.

### Out of scope / explicitly NOT changed

- No relaxation of RLS on `warehouse_items`, `warehouse_bins`, `warehouse_location_companies`.
- No change to "All Locations" behavior.
- No change to other tabs (Bin Master, Categories, Units, Stock Audit) — they have their own scopes.
- No change to `warehouse_items.company_id` / `location_id` write paths (already correct per prior plan).

### Verification

1. Company `NCG Warehouse Solutions`, location `All Locations` → current 200+ items still load (unchanged).
2. Same company, select sub-location `Lyceum…` → table now shows only NCG items physically present at `Lyceum…` (likely 0 or a small subset), not the full NCG list.
3. Switch company to `LIS` with sub-location `Lyceum Anuradhapura` → shows LIS items at that node; switching to `LGH` at the same node shows a disjoint LGH-only set (multi-tenant isolation proven).
4. Items with NULL `location_id` whose bin allocations live at the selected location appear correctly (no false negatives).
5. Items at a different location of the same company do NOT appear (no false positives).
6. Bin filter dropdown only shows bins of the selected location.
7. Network panel shows `POST /rpc/get_company_inventory_at_location` when a location is selected.

### Files to modify

- `supabase/migrations/<new>.sql` — extend `get_company_inventory_at_location` with the bin-derived presence union.
- `src/hooks/useWarehouseItemsLazyInventory.ts` — branch on `locationId` and route to the RPC.
- `src/components/warehouse/ItemMasterTab.tsx` — scope the bin filter dropdown to `globalLocationId`; explicit empty state for "no inventory at this location".
- (No changes to `LocationSelector`, `LocationFilterContext`, RLS, or other tabs.)

