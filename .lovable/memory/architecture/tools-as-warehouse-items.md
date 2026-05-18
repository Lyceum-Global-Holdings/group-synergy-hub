---
name: tools-as-warehouse-items
description: Tools are warehouse items with item_type='tool' + is_loanable=true; bin moves write to warehouse_bin_allocations
type: architecture
---
Tools are NOT a separate inventory. Every tool exists as a row in
`warehouse_item_catalog` (with `item_type = 'tool'`, item_code prefixed
`TOOL-…`) plus a per-company `warehouse_items` row (`is_loanable = true`,
`condition` column). Bin allocations live in `warehouse_bin_allocations`
exactly like normal items, so stock adjust / transfer / GRN / audit /
ledger / valuation work uniformly.

Legacy tables `warehouse_tools` and `tool_bin_allocations` remain during
transition. Bidirectional sync triggers
(`sync_tool_to_warehouse_item`, `sync_tool_bin_alloc_to_warehouse`,
`sync_warehouse_item_to_tool`, `sync_warehouse_bin_alloc_to_tool`) keep the
two sides in lockstep with `pg_trigger_depth() <= 1` guard.

Phase 2a (current): every `warehouse_tools` row has a cached
`warehouse_item_id` pointer to its standard inventory row. The forward sync
trigger populates this pointer on insert; backfill populated existing rows.
`useToolBinAllocations` (allocate/move/remove) now writes directly to
`warehouse_bin_allocations` using this pointer — so the standard
qty_before/after ledger trigger fires and stock changes appear correctly in
ledger / valuation / audit. The legacy `tool_bin_allocations` table is
read-only for the per-tool detail panel and stays in sync via the existing
trigger.

`useWarehouseTools` create/update/delete still target `warehouse_tools`;
the forward sync trigger cascades each write into the standard catalog +
warehouse_items rows, so tools appear in Inventory automatically.

Do NOT add tool-specific read paths anywhere. Inventory, Bin Allocations,
GRN, transfers, audits all use the standard warehouse_items /
warehouse_bin_allocations queries; tools appear automatically with a Type
badge driven by `warehouse_item_catalog.item_type`.

Phase 2b (future): rewrite Tool Management hooks to call standard item APIs
directly, then drop `warehouse_tools`, `tool_bin_allocations`, the four
sync trigger functions, and the `warehouse_item_id` cache column.
