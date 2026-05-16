## Root cause

The trigger `trg_warehouse_bins_set_root` (function `warehouse_bins_set_root()`) rewrites every bin's `location_id` to the **root warehouse**, regardless of which sub-location/sub-space the user selected. Allocation triggers then faithfully copy that wrong location onto stock — so stock created against `LFC › 9th Floor › NWS` lands on `LFC` (the main warehouse).

This violates SAP EWM / Oracle WMS / Manhattan / GS1 Logistics Interoperability practice, where a **Storage Bin** is a leaf address inside a specific **Storage Section** under a specific **Storage Type**, and stock is always posted to that exact node.

## Target model (SAP EWM / Oracle WMS / GS1-aligned)

```text
Warehouse / Site                  (SAP: Warehouse No.    | GS1: SGLN root)
  └─ Storage Type / Sub-location  (SAP: Storage Type     | Oracle: Sub-inventory)
       └─ Storage Section / Sub-space (SAP: Section      | Oracle: Locator zone)
            └─ Storage Bin        (SAP: Storage Bin      | GS1: SGLN extension)
                 └─ Bin Position  (SAP: Bin Position     | optional sub-bin/shelf)
```

Invariants:

- `warehouse_bins.location_id` = the **exact** physical node the bin lives in (Storage Type, Section, or Warehouse — wherever it is placed).
- `warehouse_bins.root_location_id` = derived helper for reporting/roll-ups only; never overrides `location_id`.
- `warehouse_bin_allocations.location_id` = mirror of `warehouse_bins.location_id` (enforced by trigger).
- Stock can only be added to a bin **at the node the bin belongs to**.
- Bin uniqueness: one row per `(location_id, lower(bin_code))` — already enforced.

## Implementation

### 1. DB — stop forcing bins to the root warehouse

Rewrite `warehouse_bins_set_root()`:

```text
NEW.root_location_id := get_root_location_id(NEW.location_id)
-- DO NOT touch NEW.location_id
```

This is the single line that is currently corrupting allocations. After this fix, bins created against a sub-location/sub-space stay there.

### 2. DB — tighten allocation parity to exact node

- `enforce_bin_allocation_location_parity()` already copies `location_id` from the bin → keep, no change needed once #1 is fixed.
- `validate_bin_allocation_location()` currently allows any descendant of the same root. Tighten it: `NEW.location_id` must equal `warehouse_bins.location_id` exactly (no "same root warehouse" loophole).
- `cascade_bin_relocation_to_allocations()` already cascades bin moves correctly — keep.

### 3. DB — repair existing data without guessing

- Identify bins whose stored `location_id` equals the root warehouse but were created with intent to live under a sub-location. We can detect candidates by:
  - Recent `warehouse_bin_relocations` history (if any).
  - Last `stock_transactions.location_id` at sub-location for that bin.
  - Bin-code prefix conventions already in use (e.g. `NWS-…`, `VEB-…`).
- Move only **unambiguous** bins to their correct sub-location node. The existing cascade trigger then moves allocations + stock.
- Produce a review list (read-only RPC + small admin view) for ambiguous bins so a human moves them — no silent data rewrites.

### 4. DB — optional sub-bin support (SAP "Bin Position" / Oracle locator slot)

Add nullable `warehouse_bins.parent_bin_id` so a bin can host child sub-bins/compartments without changing the location hierarchy. Child bin always inherits `location_id` from its parent bin (trigger). This is how SAP EWM models bin positions and how GS1 SGLN extensions nest.

Out-of-scope to use immediately — schema only, picker support can come later.

### 5. Frontend — exact-location bin picker (SAP RF-style)

Affected screens:

- `src/components/warehouse/AddFromCatalogDialog.tsx`
- `src/components/warehouse/BulkStockUploadDialog.tsx`
- Any other stock-add/putaway/transfer dialog using `useWarehouseBins` (audit during the change).

Rules:

- After user picks a Stock Location, show **only** bins whose `warehouse_bins.location_id === selectedLocationId`. No ancestor inheritance for putaway/add-stock.
- Use a Combobox (Command pattern) with breadcrumb `LFC › 9th Floor › NWS · 1-B-2-3`.
- If the selected node has zero bins, show an explicit "No bins here — create one" affordance instead of silently falling back to parent bins.
- Read-only browsing screens (e.g. inventory tab, reports) may keep inheritance to roll up totals, but never the picker.

Replace `useBinsForLocation` inheritance for write paths with an exact-match RPC `list_bins_at_location(p_location_id uuid)` that filters `warehouse_bins.location_id = p_location_id`.

### 6. Reporting/inventory filters

`list_warehouse_inventory` and bin lists must:

- Show bins grouped by their exact `warehouse_bins.location_id`.
- When filtering by a warehouse root, optionally include descendants (clear toggle), never collapse them onto the root row.

### 7. Memory

Replace `architecture/bin-allocation-location-parity` with the stricter rule:

> Bins are addressed at their exact physical node (SAP EWM Storage Bin under its Storage Type/Section). Triggers must never rewrite `warehouse_bins.location_id` to the root warehouse. Allocation `location_id` must equal `warehouse_bins.location_id` exactly.

## Out of scope

- Renaming locations or bins.
- Changing RLS / company isolation.
- Building a full SAP-EWM storage-type config UI (we keep current 3-level model: warehouse / sub-location / department).

## Expected result

- Stock added under a sub-location or sub-space stays there.
- Bins are never silently rebound to the main warehouse.
- Bin picker is exact-node scoped — no irrelevant main-location bins surface.
- Data model matches SAP EWM Storage Bin / Oracle Locator / GS1 SGLN conventions.