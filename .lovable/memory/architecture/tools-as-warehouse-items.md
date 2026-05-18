---
name: tools-as-warehouse-items
description: Tools are warehouse items with item_type='tool' + is_loanable=true; stock flows through standard inventory
type: architecture
---
Tools are NOT a separate inventory. Every tool exists as a row in
`warehouse_item_catalog` (with `item_type = 'tool'`, item_code prefixed
`TOOL-…`) plus a per-company `warehouse_items` row (`is_loanable = true`,
`condition` column). Bin allocations live in `warehouse_bin_allocations`
exactly like normal items, so stock adjust / transfer / GRN / audit /
ledger / valuation work uniformly.

Legacy tables `warehouse_tools` and `tool_bin_allocations` are kept during
transition for the existing Tool Management UI. Bidirectional sync triggers
(`sync_tool_to_warehouse_item`, `sync_tool_bin_alloc_to_warehouse`,
`sync_warehouse_item_to_tool`, `sync_warehouse_bin_alloc_to_tool`) mirror
writes both ways with `pg_trigger_depth() <= 1` guard. Issue/return
workflows (`tool_issues`, `tool_returns`) keep their tables but now also
carry `warehouse_item_id`.

Do NOT add tool-specific read paths anywhere. Inventory, Bin Allocations,
GRN, transfers, audits all use the standard warehouse_items /
warehouse_bin_allocations queries; tools appear automatically with a Type
badge driven by `warehouse_item_catalog.item_type`.

Phase 2 (future): rewrite Tool Management to write to warehouse_items
directly, then drop `warehouse_tools`, `tool_bin_allocations`, and the
four sync trigger functions.
