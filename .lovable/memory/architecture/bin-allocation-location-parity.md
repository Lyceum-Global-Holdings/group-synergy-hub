---
name: bin-allocation-location-parity
description: Bin's home location/company is source of truth; warehouse_bin_allocations inherits via DB trigger; location-scoped reads filter by warehouse_bins.location_id
type: architecture
---

`warehouse_bins.location_id` and `warehouse_bins.company_id` are the single source of truth for where stock physically lives.

- DB trigger `trg_enforce_bin_allocation_location_parity` (BEFORE INSERT/UPDATE on `warehouse_bin_allocations`) write-throughs `location_id` and `company_id` from the bin. Callers cannot store mismatched values.
- DB trigger `trg_cascade_bin_relocation` (AFTER UPDATE on `warehouse_bins`) cascades location/company changes into all child allocations — moving a bin moves its stock.
- Location-scoped reads (e.g. `list_warehouse_inventory`) MUST filter and group by `warehouse_bins.location_id`, never by `warehouse_bin_allocations.location_id`. The allocation row's location is a denormalised mirror only.
- Same rule applies to any new RPC, view, or report that scopes inventory by location.
