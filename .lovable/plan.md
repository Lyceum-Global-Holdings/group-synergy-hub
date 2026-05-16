## Problem

After we merged storage bins to the root warehouse (SAP EWM model), the inventory queries still filter physical stock with `bin.location_id = <selected location>` **exactly**. Result:

- **Pick a sub-location** in the global location filter → no bins match (they all live at the root) → "no inventory" empty state, even when stock exists.
- **Pick the root warehouse** → only bins literally tagged with that root match. Anything that historically still references a sub-location ID (legacy `warehouse_items.location_id`, `stock_transactions.location_id`) is invisible.

The user wants the standard WMS behaviour: any node in a warehouse tree should display the same on-hand picture — the **entire warehouse subtree** rolls up.

## Fix — single source of truth, applied server-side

Introduce one SQL helper and route every inventory/stock query through it. No more ad-hoc location filters scattered across hooks.

### 1. New SQL helper `get_location_subtree_ids(p_location_id uuid)`

Recursive CTE returning the **root ancestor + every descendant of that root**. So passing in any node — root, sub-location, sub-sub-location — returns the full warehouse tree's location IDs.

```text
warehouse A (root)
├── Zone 1
│   └── Aisle 1A
└── Zone 2
```

`get_location_subtree_ids(<Aisle 1A>)` → `{A, Zone 1, Aisle 1A, Zone 2}`
`get_location_subtree_ids(<A>)` → `{A, Zone 1, Aisle 1A, Zone 2}`

This is the canonical "warehouse scope" set.

### 2. Patch `get_company_inventory_at_location`

Replace the equality filters with subtree membership:

- `wi.location_id = ANY (subtree)`
- `wb.location_id = ANY (subtree)`

Keep the existing `can_access_company` + `get_effective_location_company_ids` security guards.

### 3. Patch `list_warehouse_inventory` RPC

Before the bins aggregation runs, expand each ID in `_location_ids` through `get_location_subtree_ids` and use the union as the bin filter. Permissions input semantics stay identical to the caller.

### 4. Patch `ItemMasterTab.tsx` `all-items-location-stock` query

Today it fetches `warehouse_bins` with `location_id = globalLocationId`. Replace with a single call to a new tiny RPC `get_subtree_bin_ids(p_location_id)` (thin wrapper over the helper) — or expand client-side by calling the helper via `supabase.rpc`. Either way, the bin set becomes the warehouse subtree.

### 5. Align `BinAllocationsTab`

It already does subtree expansion *client-side* (descendants only). Switch to the same helper for parity — eliminates the drift between "Bin allocations" and "Inventory" tabs when the same location is selected.

### 6. No data migration required

Bins are already snapped to root by the existing trigger. Allocations reference bins. The fix is purely query-side.

## Verification

- Select a known sub-location with historical stock → Inventory tab shows the same rows as selecting its root warehouse.
- Select the root warehouse → totals equal the sum of every sub-location's bin allocations (no double-counting; DISTINCT on `(wi.created_at, wi.id)` already handles that).
- Bin Allocations tab and Inventory tab show consistent counts for the same selected location.

## Out of scope

- Splitting bins back per sub-location (the previous architectural decision stands).
- New UI; only data-layer fixes.
- Reworking permissions — location ACL evaluation is unchanged.

## Files touched

- `supabase/migrations/<new>.sql`
  - `CREATE OR REPLACE FUNCTION get_location_subtree_ids(uuid)`
  - `CREATE OR REPLACE FUNCTION get_subtree_bin_ids(uuid)` (helper, optional)
  - Rewrite `get_company_inventory_at_location`
  - Rewrite `list_warehouse_inventory` (only the bins-jsonb sub-select + filter expansion)
- `src/components/warehouse/ItemMasterTab.tsx` — replace direct `warehouse_bins.eq('location_id', …)` with the helper RPC.
- `src/components/warehouse/BinAllocationsTab.tsx` — use the helper instead of in-memory descendant walk.
- `.lovable/plan.md` — log the fix.
