## Problem

The previous fix made `get_location_subtree_ids` resolve any node up to its **root warehouse first**, then return the whole tree. Result: selecting a sub-location returns every sibling sub-location's stock too. This violates standard WMS scoping (SAP EWM, Manhattan, Oracle WMS), where a storage node owns only itself and its descendants — never its parents or siblings.

## Correct Scoping Rule (International WMS Standard)

For any selected location node N, the visible stock scope is:

```text
scope(N) = { N } ∪ descendants(N)
```

- Leaf sub-location → only its own bins/allocations
- Mid-level zone → that zone + all child aisles/bins
- Root warehouse → entire warehouse (rollup of every descendant)

Parents and siblings are never included. This matches SAP EWM's Storage Section / Storage Bin hierarchy and ISA-95 location modeling.

## Changes

### 1. Database — fix subtree helper (single migration)

Rewrite `public.get_location_subtree_ids(p_location_id uuid)` to start the recursive CTE **at the selected node**, not at the root:

```sql
WITH RECURSIVE tree AS (
  SELECT id FROM warehouse_locations WHERE id = p_location_id
  UNION ALL
  SELECT child.id
  FROM warehouse_locations child
  JOIN tree t ON child.parent_id = t.id
)
SELECT id FROM tree;
```

Drop the `get_root_location_id(...)` call inside it. `get_subtree_bin_ids`, `get_company_inventory_at_location`, and `list_warehouse_inventory` all consume this helper and need no further change — their semantics automatically become "self + descendants".

### 2. Frontend — no logic changes needed

`ItemMasterTab.tsx`, `BinAllocationsTab.tsx`, and `useWarehouseItemsLazyInventory.ts` already call the helper/RPC. They inherit the corrected behavior.

### 3. Legacy fallback rows

`warehouse_items.location_id` and `stock_transactions.location_id` rows pinned to a parent location will continue to surface at that parent (correct: they belong to that node). They won't leak into siblings.

## Verification

| Selection | Expected |
|---|---|
| Leaf bin location | Only its own allocations |
| Mid zone | Zone + child aisles/bins, nothing from sibling zones |
| Root warehouse | Full rollup of all descendants |
| "All locations" (null) | Unchanged, no filter |

Manual check: pick a sub-location with known stock → Inventory tab and Bin Allocations tab show identical row counts limited to that subtree.

## Files

- `supabase/migrations/<new>.sql` — replace `get_location_subtree_ids` body
- `.lovable/plan.md` — log the correction

No frontend, type, or RLS changes.
