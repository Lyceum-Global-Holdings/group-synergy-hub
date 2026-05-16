---
name: bin-allocation-location-parity
description: Bins are addressed at their exact physical node (SAP EWM Storage Bin); triggers never rewrite bin location_id to the root warehouse; allocation location_id must match bin exactly
type: architecture
---

`warehouse_bins.location_id` is the EXACT physical node the bin lives in
(warehouse, sub-location, or department/sub-space) — SAP EWM Storage Bin
discipline. It must never be silently rewritten to the root warehouse.

Rules enforced in DB:

- `warehouse_bins_set_root()` only sets `root_location_id` (derived helper for
  reporting). It does NOT touch `location_id`.
- `validate_bin_allocation_location()` forces `warehouse_bin_allocations.location_id`
  to equal `warehouse_bins.location_id` exactly — no "same root warehouse"
  loophole. `company_id` is mandatory.
- `enforce_bin_allocation_location_parity()` mirrors bin location/company onto
  the allocation on every INSERT/UPDATE.
- `cascade_bin_relocation_to_allocations()` cascades bin moves onto all child
  allocations.
- Optional sub-bins (SAP "Bin Position") use `warehouse_bins.parent_bin_id`;
  child bins inherit the parent bin's `location_id` via
  `warehouse_bins_inherit_parent_location()`.

Frontend rules for write paths (putaway, add-stock, transfer destination):

- Use `useBinsAtLocation(locationId)` / RPC `list_bins_at_location(p_location_id)`.
- NEVER use inherited bin lists (`list_bins_for_location_inherited`) for write
  paths — that RPC is reporting-only.
- When the selected node has zero bins, show "No bins at this location" — never
  fall back to ancestor bins.

Read-only reporting/inventory roll-ups may include descendants, but must always
group/show stock at the bin's exact `location_id`.
