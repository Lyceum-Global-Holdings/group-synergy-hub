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

Phase 2b (current — stock-flow slice): tool Issue, Return, and Adjustment
flows now post to the unified inventory ledger in addition to the legacy
warehouse_tools writes. Three SECURITY DEFINER RPCs handle this:
`tool_issue_post_ledger`, `tool_return_post_ledger`, and
`tool_adjustment_post_ledger`. They mutate `warehouse_bin_allocations`
(reserved_quantity for loans; allocated_quantity for write-offs/adjustments)
and `warehouse_items.current_stock`, then insert `stock_transactions` rows
(`material_issue` / `material_return` / `adjustment`) so tool movements show
up in unified stock views, ledger, and valuation. Hooks
(`useToolIssues`, `useToolReturns`, `useToolAdjustments`) call these RPCs
and invalidate warehouse stock caches on success. Legacy
`warehouse_tools` / `tool_bin_allocations` tables are still maintained by
the existing hook code + sync triggers — no FKs or read paths changed.

Phase 2c (future): drop `tool_id` FKs in favor of `warehouse_item_id`, drop
`warehouse_tools` + `tool_bin_allocations` + the four sync trigger
functions + `get_warehouse_tools_list`, and rewrite Tool Management read
paths to query `warehouse_items` directly.
