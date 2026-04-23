

## Standalone sub-location warehouses with independent multi-company inventory

### Outcome

- Any node in the location hierarchy (`location`, `sublocation`, `department`) can act as a **standalone stocking warehouse**, independent of its parent.
- The same physical sub-location can hold inventory for **multiple different companies** simultaneously, with each company seeing only its own stock.
- Company assignment to a sub-location is **independent of its parent** when needed, while still supporting `inherit_parent` for convenience.
- All location pickers, inventory queries, and stock movements use one canonical resolver and respect company scoping.

Aligned with:
- **SAP EWM** — every storage node can independently be a stock-bearing location for multiple plants
- **GS1 GLN (ISO/IEC 6523)** — each physical location has a stable identity decoupled from hierarchy
- **ISO 8000** — single authoritative master-data resolution
- **ISO/IEC 27001 A.9** — company-scoped access enforced server-side

### Root model (already mostly in place — needs formalization)

```text
warehouse_locations (id, type, parent_id, company_assignment_mode)
   └── warehouse_location_companies (location_id, company_id)   ← multi-company membership
warehouse_items (location_id, company_id, ...)                  ← per-company inventory at a location
```

The data model already supports the scenario. What is missing:

1. A first-class **`is_standalone_warehouse`** flag on `warehouse_locations` so a sub-location can be marked as its own stocking warehouse independent of its parent's role.
2. An **independent company assignment mode** for standalone sub-locations (force `explicit`, never inherit).
3. A **canonical inventory-visibility resolver** so item lists, stock counts, and movements at a standalone sub-location are cleanly company-scoped.
4. A **sub-location-aware location picker** that lets users choose any stock-bearing node — not just top-level locations.

### Changes

#### 1) Database

**Migration:**

- Add column `warehouse_locations.is_standalone_warehouse boolean NOT NULL DEFAULT false`.
- Add CHECK / trigger: if `is_standalone_warehouse = true` then `company_assignment_mode = 'explicit'` (a standalone warehouse must declare its own companies, never inherit silently).
- Backfill: any sub-location that already has explicit `warehouse_location_companies` rows AND its parent has a different company set → mark `is_standalone_warehouse = true`.
- New RPC `get_stock_bearing_locations_for_company(p_company_id uuid)` built on top of the proven `get_effective_location_company_ids(location_id)` resolver. Returns all locations (any type) where this company has effective access — with hierarchy metadata.
- New RPC `get_company_inventory_at_location(p_company_id uuid, p_location_id uuid)` to return only inventory rows where `warehouse_items.company_id = p_company_id` AND `location_id = p_location_id`. This guarantees per-company inventory isolation even when many companies share a physical sub-location.
- Reuse existing `get_effective_locations_for_company` for picker lists; do not duplicate logic.

#### 2) Frontend — admin master data

`src/components/warehouse/LocationManagementDialog.tsx` and `src/pages/admin/WarehouseManagement.tsx`:

- Add a **"Standalone Warehouse"** toggle in the location form.
- When ON:
  - Force `assignment_mode = 'explicit'` and disable the inherit option.
  - Show explainer: "This sub-location operates as its own warehouse. Companies and inventory are managed independently from its parent."
- When OFF and `parent_id` is set: keep current `inherit_parent` default.
- Show a **"Companies served"** chip list (resolved from `warehouse_location_companies`) on each location row.

#### 3) Frontend — pickers and inventory views

All pickers continue to use the canonical hooks (`useEffectiveLocationsForCompany`, `useEffectiveLocationsForCompanies`). Add hierarchy-aware rendering already in place (`↳` indent).

`InventoryItems.tsx`, `WarehouseItemsTab`, stock movement screens:

- When user selects a sub-location in the picker, query inventory using `get_company_inventory_at_location(selectedCompany, selectedLocation)` so only that company's stock at that physical sub-location is shown.
- Stock-add / GRN / transfer dialogs always set `warehouse_items.company_id` from the active company context — never inferred from the location.

#### 4) Permissions

`user_location_permissions` continues to grant per-location access. Hierarchy expansion already exists in `LocationSelector`. No relaxation needed — a standalone sub-location is just another node a user can be granted access to.

### Verification

1. Mark `Lyceum Anuradhapura` (sub-location) as **Standalone Warehouse** with companies `LIS` and `LGH`.
2. Selecting `LIS` shows `Lyceum Anuradhapura` in pickers; selecting `LGH` also shows it.
3. Add stock for an item at `Lyceum Anuradhapura` while `LIS` is active — `LGH` user does not see those stock rows.
4. Add a different stock row at the same `Lyceum Anuradhapura` while `LGH` is active — `LIS` user does not see it.
5. Parent location's companies do not leak access to the standalone sub-location's inventory.
6. Admin Warehouse Management shows the "Companies served" chips and the standalone flag correctly.

### Files to modify

- `supabase/migrations/<new>.sql` — add column, CHECK trigger, two RPCs
- `src/components/warehouse/LocationManagementDialog.tsx` — standalone toggle
- `src/pages/admin/WarehouseManagement.tsx` — standalone toggle in edit dialog, chips
- `src/hooks/useWarehouseLocations.ts` — expose `useStockBearingLocationsForCompany` and `useCompanyInventoryAtLocation` hooks
- `src/pages/construction/resources/InventoryItems.tsx` — switch to `get_company_inventory_at_location`
- `src/components/warehouse/ItemMasterTab.tsx` (and equivalent inventory tabs) — same per-company-at-location query path
- `src/types/warehouse.ts` — add `is_standalone_warehouse` to `WarehouseLocation` and create payloads

### Constraints

- Do not relax RLS on `warehouse_location_companies` or `warehouse_items`.
- Do not infer `warehouse_items.company_id` from the location — it must come from the active company context.
- Standalone sub-locations must use `explicit` assignment mode (enforced by trigger).
- All pickers continue to read through the canonical effective-location RPCs — no new direct junction-table queries.

