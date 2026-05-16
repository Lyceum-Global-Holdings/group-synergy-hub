# Bin ↔ Location Hierarchy: Warehouse-Scoped Bins

## Problem

Today `warehouse_bins.location_id` points at one specific node (location, sub-location, or department). Uniqueness is `(bin_code, company_id, location_id)`, so the same physical bin (e.g. `A-01-01`) has to be re-created for every sub-location and department under the same warehouse. Stock operations at a sub-location can't see the parent warehouse's bins.

## International Standard (SAP EWM / Oracle WMS / GS1)

A storage bin belongs to **one warehouse (root node)**. Zones, aisles, sub-locations and departments are *addressable areas inside that warehouse* and all share the warehouse's bin master. Bin codes are unique **per warehouse + company**, not per sub-node.

We will adopt the same model:

```text
Company
└── Warehouse (root location)         ← bins live here
    ├── Sub-location (zone/floor)     ← uses parent's bins
    │   └── Department                ← uses parent's bins
    └── Sub-location
```

## Data Model Changes

1. **`warehouse_bins`**
   - Add `root_location_id uuid` (the top-level warehouse). Required going forward.
   - Backfill: walk `warehouse_locations.parent_id` up to the node whose `type = 'location'` (or whose `parent_id IS NULL`).
   - Keep existing `location_id` for backward compatibility but treat it as legacy; new writes set both `location_id = root_location_id` and `root_location_id`.
   - Replace unique index `warehouse_bins_code_company_location_uniq` with **`(bin_code, company_id, root_location_id)`** (partial, where both not null).
   - Add index on `(company_id, root_location_id, bin_code)` for fast lookup.

2. **Helper function** `public.get_root_location_id(_location_id uuid) RETURNS uuid` — recursive CTE up the `parent_id` chain, returns the topmost ancestor for the given node. `STABLE`, `SECURITY INVOKER`.

3. **Validation trigger** on `bin_allocations` (and any other table that pairs `bin_id` + `location_id`): ensure `get_root_location_id(NEW.location_id) = (SELECT root_location_id FROM warehouse_bins WHERE id = NEW.bin_id)`. Prevents allocating a bin to a sub-location of a different warehouse.

4. **Backfill migration** safely:
   - Compute `root_location_id` for every existing bin.
   - Where collisions appear (same `bin_code` already exists at warehouse level for the same company), merge: keep the bin tied to the warehouse-root row, repoint `bin_allocations.bin_id`, then delete the duplicate.

## Backend Surfaces

- **`bulk_clone_bin_scope` RPC**: now operates on **root warehouses only**. Target picker excludes sub-locations and departments — replicating to a sub-location is meaningless under the new model.
- Any RPC/view that lists bins for a location (`list_bins_for_location`, etc.) resolves the root and filters by `root_location_id`.

## Frontend Changes

- **`CreateBinDialog`**: location field shows only top-level warehouses (`type = 'location'`). Helper text: "Bin will be available in this warehouse and all its sub-locations / departments."
- **`BinMasterTab`**: 
  - "Location" column renamed "Warehouse"; shows root warehouse.
  - New small "Used in" indicator listing sub-locations where the bin currently has allocations.
  - Selection / bulk-scope dialog updated for warehouse-only targets.
- **Stock operation pickers** (Putaway, GRN, Stock Transfer, Bin Allocation, Material Issue): when the user selects a sub-location, resolve its root via `buildLocationOptions` (extend with `rootId`) and load bins where `root_location_id = root`. Existing top-level location case continues to work unchanged.
- **`locationHierarchy.ts`**: add `rootId` to each option for client-side root resolution without an extra query.

## Migration / Rollout

Single migration, executed in this order inside a transaction:
1. Add nullable `root_location_id`, create `get_root_location_id()`.
2. Backfill `root_location_id` for all bins.
3. Detect duplicates per `(bin_code, company_id, root_location_id)`; merge allocations, delete duplicates, log to `security_audit_log` (`action: bin_warehouse_merge`).
4. Set `root_location_id NOT NULL`, drop old unique index, create new one.
5. Install validation trigger on `bin_allocations`.

## Out of Scope

- No change to `bin_allocations.quantity` or stock numbers — only the bin↔location relationship is restructured.
- No QR re-print flow (existing QR payloads keep working; they reference `bin_id`).
- No change to `warehouse_locations` table structure or hierarchy depth.
- No change to RBAC, RLS policies, or company scoping rules.

## Verification

- Existing bins still resolve in Bin Master and show their warehouse.
- Creating a bin at warehouse "Main DC" makes it pickable in Putaway when the user selects "Main DC › Floor 2 › Receiving Dept".
- Trying to create a duplicate `A-01-01` in the same warehouse fails with a clear error; creating it in a different warehouse succeeds.
- Bulk-scope dialog only lists warehouses, replication works across companies.
- Allocating a bin against a sub-location of a different warehouse is blocked by the trigger.
