---
name: MRN per-line return-to-bin
description: Material Return Notes carry a per-line bin_id; auto-prefilled from the source MIN's issuing bin (or current allocation for supplier returns); approval posts to that exact bin
type: feature
---

`material_return_items.bin_id` (nullable FK → `warehouse_bins.id`) is the destination bin a return line is posted to on approval (SAP EWM mvt 653/655 pattern; ISO 9001 §8.5.4 traceability).

Defaults:
- Internal MRN: `get_min_issued_bins(p_min_id, p_item_id)` returns bins the MIN issued the item from, ordered by qty desc. Dialog pre-fills the top bin and shows "Originally issued from {bin_code}" hint.
- Supplier MRN: defaults to the largest current `warehouse_bin_allocations` row for (item, company) filtered to the MRN's location.

Picker scope: `useBinsAtLocation(location_id)` — exact-node bins only (no ancestor inheritance), matching project bin-allocation-location-parity rule.

`approve_material_return` upserts the (item, bin, company) allocation row, then calls `process_material_return_stock_update` with that allocation id. Raises `23514` if any returnable line has `bin_id IS NULL`.

`get_material_return_items` returns `bin_id` and `bin_code` for the details dialog.

MIN/GRN bin handling unchanged: MIN consumes bins via FIFO at approval; GRN uses its own approve-time bin allocation dialog.
