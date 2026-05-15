## Goal

When a bin is created against a parent location (e.g. `LNNB`), it should also appear as a selectable bin everywhere a child sub-location or department under that parent is chosen (e.g. `9th Floor`, `NGN`). This mirrors SAP EWM "storage type / storage section" inheritance and GS1 GLN sub-location semantics: a bin defined at a higher node in the location hierarchy is implicitly available to every node beneath it.

This change is **bin-picker visibility only**. Stock balances and `stock_transactions` stay scoped to the actual physical location where stock sits (per the existing Stock Tx Location Scope rule). We are not duplicating bin rows or moving stock.

## Current behavior

- `warehouse_locations` is a 3-level tree: `location → sublocation → department` via `parent_id`.
- `warehouse_bins.location_id` points to one location row.
- Every bin picker (Add/Edit Partial Piece, Bin Allocation, Stock Adjustment, Material Issue, Transfer, GRN, etc.) loads bins with a flat filter:
  `from('warehouse_bins').select(...).eq('location_id', selectedLocationId)`
- Result: a bin attached to `LNNB` is invisible when the user picks `LNNB → 9th Floor → NGN`.

## Proposed change

### 1. Database — ancestor-aware bin lookup (single source of truth)

Add a SQL helper + RPC (SECURITY INVOKER, so RLS still applies):

```sql
-- Returns the chosen location plus all ancestors up the parent_id chain.
create or replace function public.get_location_with_ancestors(p_location_id uuid)
returns table(location_id uuid)
language sql stable security invoker set search_path = public as $$
  with recursive chain as (
    select id, parent_id from warehouse_locations where id = p_location_id
    union all
    select wl.id, wl.parent_id
    from warehouse_locations wl
    join chain c on wl.id = c.parent_id
  )
  select id from chain;
$$;

-- Returns active bins visible at p_location_id, including bins inherited
-- from any ancestor location. Adds an `inherited_from_location_id` column
-- so the UI can label inherited rows.
create or replace function public.list_bins_for_location_inherited(p_location_id uuid)
returns table(
  id uuid, bin_code text, bin_type text, location_id uuid,
  inherited_from_location_id uuid, inherited_from_location_name text,
  is_active boolean, capacity numeric, current_utilization numeric,
  is_global_template boolean
)
language sql stable security invoker set search_path = public as $$
  with anc as (select location_id from public.get_location_with_ancestors(p_location_id))
  select b.id, b.bin_code, b.bin_type, b.location_id,
         case when b.location_id <> p_location_id then b.location_id end,
         case when b.location_id <> p_location_id then wl.name end,
         b.is_active, b.capacity, b.current_utilization, b.is_global_template
  from warehouse_bins b
  join anc on anc.location_id = b.location_id
  join warehouse_locations wl on wl.id = b.location_id
  where coalesce(b.is_active, true)
  order by (b.location_id <> p_location_id), b.bin_code; -- own bins first, inherited next
$$;
```

No schema changes to `warehouse_bins`. No data migration. RLS unchanged — the recursive CTE only walks `warehouse_locations`, which is already readable to permitted users.

### 2. Frontend — switch every bin picker to the inherited list

Replace direct `warehouse_bins` queries that filter by `location_id` with an RPC call. New shared hook:

```
src/hooks/warehouse/useBinsForLocation.ts
  useBinsForLocation(locationId) -> { bins, isLoading }
  Calls supabase.rpc('list_bins_for_location_inherited', { p_location_id })
```

Pickers updated to use it (visibility-only, no logic change):

- `AddPartialPieceDialog.tsx`
- `EditPartialPieceDialog.tsx`
- `CreateBinAllocationDialog.tsx`
- `AssignLocationDialog.tsx` (per-row bin select)
- `StockAdjustmentDialog.tsx`, `StockMovementDialog.tsx`
- `CreateMaterialIssueDialog.tsx`, `CreateMaterialRequestDialog.tsx`
- `CreateStockTransferDialog.tsx`, `ItemTransferDialog.tsx`
- `GrnDetailsDialog.tsx`, `BulkStockUploadDialog.tsx`
- Tools picker (`ToolsInventoryTab.tsx`) and `ScannedBinAdjustmentDialog.tsx`

In each `<SelectItem>`, when `inherited_from_location_name` is present, show a small muted suffix like `BIN-001 · inherited from LNNB` so operators still understand provenance (international WMS practice — never silently hide the source node).

`useWarehouseBins()` (Bin Master tab list / CRUD) is **unchanged** — masters still show each bin under the exact location it was created at.

### 3. Out of scope

- No changes to `warehouse_bins` rows, RLS, or uniqueness rules.
- No changes to stock-balance scoping or `stock_transactions` (location scope rule preserved).
- No changes to bin-allocation uniqueness (one bin per item still enforced via the existing constraint, now naturally extending across the hierarchy).
- No changes to permissions: a user who cannot view the parent location still cannot see its bins, because the RPC runs as SECURITY INVOKER and joins `warehouse_locations` under existing RLS.

## Files

- New migration: `get_location_with_ancestors` + `list_bins_for_location_inherited`
- New hook: `src/hooks/warehouse/useBinsForLocation.ts`
- Edits in ~12 picker components listed above (swap query, render inherited badge)

## Acceptance

- Creating bin `LNNB-A1` at location `LNNB`, then selecting `LNNB → 9th Floor → NGN` in any picker shows `LNNB-A1` (labelled "inherited from LNNB") alongside any bins owned directly by `NGN`.
- Bin Master list still shows each bin only at its owning location.
- Stock posted into `LNNB-A1` from `NGN` is recorded against `NGN` in `stock_transactions` (no change to balance scoping).
