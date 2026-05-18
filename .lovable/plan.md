# Unify tools into the warehouse inventory (SAP-style material type)

## Why

The previous fix merged tools into Bin Allocations / Inventory at the read
layer, but tools still live in their own `warehouse_tools` /
`tool_bin_allocations` tables. That means every stock workflow — adjust,
transfer, GRN, putaway, audit, FIFO, ledger, valuation — is duplicated or
unavailable for tools. International WMS practice (SAP MM, Oracle, NetSuite)
keeps **one material master**, and differentiates behavior via a
**material type** (`ERSA`/`NLAG`/`HIBE` for tools/consumables). The same
items table powers stock; the "tool" character is an attribute, not a
parallel table.

## Target architecture

```text
warehouse_item_catalog        (master)         ← tools live here, item_type='tool'
        │
        ├─ warehouse_items           (per-company on-hand row)
        │       │
        │       └─ warehouse_bin_allocations   (per-bin qty)
        │
        └─ stock_transactions (ledger)  • valuation • reorder • audit  ─┐
                                                                       │
Tool-specific lifecycle stays separate (loanable behavior):            │
   tool_issues / tool_returns  ── now reference warehouse_items.id ────┘
```

Result: stock, bins, transfers, GRN, audits, valuation — all one path.
Issue/Return is the only tool-specific workflow and keeps its own tables,
but those tables now point at `warehouse_items`.

## Migration plan (one migration, reversible-safe)

### Schema

1. Add `warehouse_item_catalog.item_type text default 'item' check (item_type in ('item','tool'))` and an index on it.
2. Add `warehouse_items.is_loanable boolean default false` (true for tools)
   and `warehouse_items.condition text` (good/fair/poor/damaged), so tool
   metadata survives the move.
3. Add `tool_issues.warehouse_item_id uuid` and
   `tool_returns.warehouse_item_id uuid` (nullable for now, FK to
   `warehouse_items` ON DELETE RESTRICT).

### Data backfill (idempotent SQL)

4. For every `warehouse_tools` row:
   - Insert/find a `warehouse_item_catalog` row keyed by `tool_code` →
     `item_code`, `item_type='tool'`, mapping category, unit, brand,
     description, image, unit_cost.
   - Insert a per-company `warehouse_items` row (one per tool row) with
     `is_loanable=true`, `condition`, `location_id`, `current_stock =
     total_quantity`, `available_quantity = available_quantity`. Use the
     existing `upsert_warehouse_inventory` RPC.
   - Copy each `tool_bin_allocations` row → `warehouse_bin_allocations`
     using the new `warehouse_item_id`. Skip if already present.
   - Set `tool_issues.warehouse_item_id` and `tool_returns.warehouse_item_id`
     via the `tool_id → warehouse_item_id` map.
5. Verify counts; emit a NOTICE per orphaned row (none expected — there are
   206 tools, 1 allocation, 4 issues, 4 returns).

### Compatibility

6. Replace `warehouse_tools` with a **view** (`security_invoker=on`) over
   `warehouse_items` filtered by `is_loanable=true`, exposing the legacy
   column names (`tool_code`, `total_quantity`, `available_quantity`,
   `issued_quantity`, `condition`, …) so the existing Tool Management UI
   keeps working without a frontend rewrite. Same trick for
   `tool_bin_allocations` → view over `warehouse_bin_allocations` filtered
   to loanable items.
7. After the FE swap (Phase 2) the legacy view can be dropped.

### RLS

8. Catalog visibility (`is_loanable` rows) reuses the existing
   `warehouse_item_catalog` policy — already global with company-scoped
   inventory. No new policy needed.

## Frontend changes

### Tool Management page

- `useWarehouseTools` now reads from `warehouse_items` with
  `catalog.item_type='tool'` (or via the compat view in Phase 1). Type
  surface stays the same so existing dialogs (Add Tool, Issue, Return,
  Allocate to Bin, Move, QR) compile unchanged.
- `AllocateToolToBinDialog` switches to the standard
  `useWarehouseBinAllocations.createAllocation` mutation.
- `MoveToolBetweenBinsDialog` calls the standard move flow.
- `IssueToolDialog` / `ReturnToolDialog` continue using
  `tool_issues` / `tool_returns`, but now write `warehouse_item_id` and
  call `stock_transactions` (out=issue, in=return) so the **standard
  ledger** records the movement and `available_quantity` reflects loans.
- "Add Tool" routes through the standard catalog + inventory create flow
  with `item_type='tool'`, `is_loanable=true`.

### Warehouse → Inventory page

- Remove the temporary `Tools` tab and `ToolsInventoryOnHand` component.
- Tools now appear naturally in the main inventory list with a "Tool"
  badge (driven by `catalog.item_type`). Add a Type filter (All / Items /
  Tools) to the existing filter bar.

### Bin Allocations page

- Remove `useAllToolBinAllocations` merge and the `_entity_type` shim —
  tools now flow through `warehouse_bin_allocations` and appear
  automatically. Keep the Type column, sourced from `catalog.item_type`.

### Cleanup

- Delete: `useAllToolBinAllocations.ts`, `ToolsInventoryOnHand.tsx`.
- Trim `WAREHOUSE_STOCK_QUERY_KEYS` back to item keys; the old
  `tool-bin-allocations*` keys stay only for the Issue/Return hooks.
- Update memory: replace `unified-on-hand-tools-merge` with a new
  `tools-as-warehouse-items` rule documenting that tools = items with
  `item_type='tool'` + `is_loanable=true`, and that every stock workflow
  uses the standard item path.

## Rollout (two-phase, no downtime)

**Phase 1 (this migration + small FE):** schema + backfill + compat views.
Tool Management UI keeps working unchanged. Inventory, Bin Allocations,
GRN, transfers, audits immediately see tools as first-class stock.

**Phase 2 (follow-up):** rewrite Tool Management hooks/dialogs to call the
standard item APIs directly, drop the compat views, drop
`warehouse_tools` and `tool_bin_allocations` tables.

## Out of scope

- Serial-number tracking per tool unit (existing tools are bulk-quantity).
- Calibration / depreciation schedules (asset module already covers this).
