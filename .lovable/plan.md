# Show tool bin allocations in Inventory + Bin Allocations

## Problem

Tools live in `warehouse_tools` with allocations in `tool_bin_allocations`. The
Warehouse → **Bin Allocations** and Warehouse → **Inventory** pages only read
`warehouse_bin_allocations` / `warehouse_items`, so a freshly allocated tool
(e.g. Ackro jak → bin LAN, qty 35) never appears there. Users have no single
place to see "what's physically in my warehouse".

## Solution overview

Add a thin DB layer that unions the two allocation sources into a single
`unified_bin_allocations` view, plus an `entity_type` column (`item` / `tool`).
Update both pages to read from this view via small RPCs so pagination,
filtering and realtime stay performant.

```text
warehouse_bin_allocations ─┐
                           ├──► unified_bin_allocations (view)
tool_bin_allocations ──────┘             │
                                         ├─► list_bin_allocations_unified RPC → Bin Allocations tab
                                         └─► list_warehouse_inventory_unified RPC → Inventory tab
```

## Changes

### 1. Database (migration)

- **View `public.unified_bin_allocations`** (`security_invoker=on`) with columns:
  `id, entity_type ('item'|'tool'), entity_id, entity_code, entity_name,
  bin_id, location_id, company_id, allocated_quantity, reserved_quantity,
  available_quantity, notes, created_at, updated_at`.
  Body: `SELECT … FROM warehouse_bin_allocations a JOIN warehouse_items_full f …
  UNION ALL SELECT … FROM tool_bin_allocations a JOIN warehouse_tools t …`.
- **RPC `list_bin_allocations_unified`** (SECURITY INVOKER, keyset paginated
  on `(created_at desc, id desc)`, filters: `p_company_id`, `p_location_ids
  uuid[]`, `p_entity_type`, `p_search`, `p_limit`, `p_cursor_created_at`,
  `p_cursor_id`). Filter-before-paginate.
- **RPC `list_warehouse_inventory_unified`** — wraps existing
  `list_warehouse_inventory` and UNION-ALLs aggregated tool rows
  (one row per tool with `sum(allocated_quantity)` across bins). Same filter
  signature so the existing hook can swap in.
- Add `tool_bin_allocations` to the realtime publication if not already there
  (`verify_realtime_coverage()` check).
- Indexes: `tool_bin_allocations(company_id, created_at DESC, id DESC)`,
  `tool_bin_allocations(bin_id)`, `warehouse_tools(company_id, name)`.

RLS: relies on existing per-table policies — view uses `security_invoker`, so
each user only sees rows their existing policies allow.

### 2. Frontend

- **New hook** `src/hooks/useUnifiedBinAllocations.ts` — mirrors
  `useWarehouseBinAllocations` shape but calls the new RPC; returns rows with
  `entity_type` discriminator.
- **`src/components/warehouse/BinAllocationsTab.tsx`**
  - Swap data source to `useUnifiedBinAllocations`.
  - Add a **Type** column (badge: "Item" / "Tool").
  - Add a Type filter (`All / Items / Tools`).
  - Row actions: hide Move/Delete/QR for tool rows in v1 (link to Tool
    Management instead) — keeps blast radius small.
- **`src/hooks/useWarehouseInventoryPage.ts`**
  - Point at `list_warehouse_inventory_unified`.
  - Returned rows carry `entity_type`; flatten helper passes it through.
- **`src/pages/warehouse/Inventory.tsx` / inventory table**
  - Add Type badge column.
  - Tool rows render with a "View in Tool Management" affordance and skip
    item-only actions (edit master, bulk adjust, etc.).
- **Realtime invalidation**: extend `WAREHOUSE_STOCK_QUERY_KEYS` in
  `src/hooks/useInvalidateWarehouseStock.ts` with
  `["tool-bin-allocations"]` and `["warehouse-tools"]`, and have
  `useToolBinAllocations` call `useInvalidateWarehouseStock()` on success so
  the unified views refresh everywhere.

### 3. Memory

Add `mem://architecture/unified-bin-allocations-view` documenting that all
on-hand reporting (Bin Allocations + Inventory) must read the unified view,
never the raw tables, so future entity types (assets, partial pieces) plug in
the same way.

## Out of scope

- Merging `warehouse_tools` into `warehouse_items` (rejected — separate
  lifecycle, issue/return semantics).
- Cross-entity transfers (tool ↔ item) — tool moves still go through Tool
  Management.
