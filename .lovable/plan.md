## Goal

Make Tool Management write directly to `warehouse_item_catalog` / `warehouse_items` / `warehouse_bin_allocations` (the standard inventory plumbing), then retire the legacy `warehouse_tools` + `tool_bin_allocations` tables and the bidirectional sync triggers installed in Phase 1.

Issue / Return workflows already carry `warehouse_item_id` from Phase 1 — they will be repointed to it and the legacy `tool_id` column is kept nullable for history only.

## Phase 2a — Frontend rewrite (no destructive DB changes yet)

Rewrite every Tool Management hook + dialog to read/write the standard tables. The Phase 1 sync triggers stay in place during this phase so anything we miss keeps working.

**`useWarehouseTools.ts`** — replace `get_warehouse_tools_list` RPC + `warehouse_tools` writes with:
- Read: `list_warehouse_inventory` RPC filtered by `item_type = 'tool'` (or a thin new RPC `list_warehouse_tools_v2` if filter not supported), mapped to the existing `WarehouseTool` shape so dialogs don't have to change.
- Create single: insert into `warehouse_item_catalog` (`item_type='tool'`, `item_code` auto-prefixed `TOOL-…`) then insert per-company `warehouse_items` (`is_loanable=true`, `condition`, `current_stock = total_quantity`).
- Create bulk: same dual-insert in a loop, batched.
- Update: split into catalog fields (name, category, unit, brand, model, serial, specs) → `update_warehouse_catalog_item` RPC; per-company fields (location, condition, status, reorder) → `warehouse_items` UPDATE.
- Delete: delete the `warehouse_items` row (RLS-verified `.select('id')`); catalog row is left alone if other companies still use it, else cascade-cleaned by a small `delete_tool_catalog_if_unused` RPC.

**`useToolBinAllocations.ts`** — delete in favor of the existing `useWarehouseBinAllocations` hook. Update the two callers (`ToolBinAllocationsPanel`, `AllocateToolToBinDialog`, `MoveToolBetweenBinsDialog`) to use `createAllocation` / `moveAllocation` from the standard hook.

**`useToolAdjustments.ts`** — rewrite to call the standard `useStockAdjustments` flow (writes `stock_transactions` + updates `warehouse_items.current_stock`). Keep the `tool_adjustments` audit row insert so historical reports keep working, but source `quantity_before` / `quantity_after` from `warehouse_items.current_stock`, not `warehouse_tools.total_quantity`.

**`useToolIssues.ts` / `useToolReturns.ts`** — write `warehouse_item_id` (already added in Phase 1) and post a `stock_transactions` row (`transaction_type='issue'` / `'return'`) so `available_quantity` reflects loans through the standard reservation pathway instead of `warehouse_tools.issued_quantity`. The `tool_issues` / `tool_returns` tables stay (they carry borrower, due-date, condition-out/in — domain-specific to tools).

**Dialogs** (`CreateToolDialog`, `EditToolDialog`, `BulkToolImportDialog`, `ImportFromItemMasterDialog`, `AllocateToolToBinDialog`, `MoveToolBetweenBinsDialog`, `ToolAdjustmentDialog`, `IssueToolDialog`, `ReturnToolDialog`, `BulkIssueToolDialog`, `BulkReturnToolDialog`) — keep UI; swap the hook calls only. `ImportFromItemMasterDialog` simplifies: just flip `item_type` to `'tool'` and set `is_loanable=true` on existing catalog rows.

**Tabs** (`ToolsInventoryTab`, `ToolBinAllocationsPanel`, `ToolIssuesTab`, `ToolReturnsTab`, `OverdueToolsTab`) — keep, just consume the rewired hooks.

## Phase 2b — DB cleanup migration

Run after Phase 2a is verified in preview:

1. Drop the four sync triggers and their functions (`sync_tool_to_warehouse_item`, `sync_tool_bin_alloc_to_warehouse`, `sync_warehouse_item_to_tool`, `sync_warehouse_bin_alloc_to_tool`).
2. `ALTER TABLE tool_issues / tool_returns` — drop the `tool_id` NOT NULL constraint (keep column for history); add `NOT NULL` on `warehouse_item_id`.
3. Drop `warehouse_tools` and `tool_bin_allocations`. (`tool_adjustments` keeps `tool_id` as a free text/uuid history column without FK.)
4. Drop the `get_warehouse_tools_list` RPC.
5. Update memory `architecture/tools-as-warehouse-items.md` to reflect Phase 2 complete.

## Out of scope

- Issue/Return business rules, overdue logic, calibration, depreciation — untouched.
- Serial-number-per-unit tracking (deferred to a separate feature).
- Reports / analytics that still join `warehouse_tools` will be migrated in a follow-up sweep using `grep` (none expected outside the hooks above based on current code search, but verify).

## Rollout

1. Implement Phase 2a in one batch, verify Tool Management screens in preview (list, create, edit, allocate, move, issue, return, adjust).
2. Then run the Phase 2b migration.
3. Final memory + plan doc updates.

Confirm and I'll start with Phase 2a.