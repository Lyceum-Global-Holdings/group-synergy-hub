---
name: bin-uniqueness
description: One warehouse_bins row per (location_id, lower(bin_code)); DB unique index + client dedupe
type: architecture
---

A storage bin is a physical address. There must be exactly one `warehouse_bins`
row per `(location_id, lower(bin_code))` (unique index
`warehouse_bins_code_per_location_uidx`). Legacy NULL-company "template"
duplicates were merged 2026-05-16; FKs from `stock_transfer_items`,
`pick_list_items`, `putaway_items`, `finished_goods_issue_items`,
`tool_bin_allocations`, `tool_issues`, `stock_transactions`,
`warehouse_partial_pieces` were repointed to the keeper bin before deletion.

`useWarehouseBins` dedupes defensively (prefers company-scoped over NULL
template) and natural-sorts by `bin_code` so `1-B-2-2` precedes `1-B-2-10`.
Pickers must render `bin_code` only, and suppress `- name` when name equals
code (the common case).

Bin location parity is still enforced by
`enforce_bin_allocation_location_parity` — see
`architecture/bin-allocation-location-parity`.
