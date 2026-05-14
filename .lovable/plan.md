## Goal
Extend the Material Issue / Material Return flow to capture and persist a **secondary quantity** (e.g. pieces) alongside the canonical base quantity, but only for items flagged `track_secondary_quantity = true`. Stock transactions and bin allocations must reflect both.

## Scope
- Material Issue (MIN): create flow + stock RPC + `IssueItemsDialog` reuse path
- Material Return (MRN): create flow + stock RPC
- Existing items without dual tracking are unaffected

## Schema changes (migration)
Add nullable secondary columns so historical rows keep working:

```sql
alter table public.material_issue_items
  add column if not exists secondary_quantity_issued numeric,
  add column if not exists secondary_uom text;

alter table public.material_return_items
  add column if not exists secondary_quantity_returned numeric,
  add column if not exists secondary_uom text;
```

(`stock_transactions.secondary_quantity_change/_before/_after`, `warehouse_bin_allocations.secondary_quantity`, and the trigger that stamps before/after already exist from the dual-tracking migration.)

## RPC changes (migration)

### `process_material_issue_stock_update`
Add new param `p_secondary_quantity_issued numeric default null`.
- When non-null and the item has `track_secondary_quantity`, **prorate** the secondary quantity across the FIFO base-quantity slices: `sec_take = round(secondary_total * (v_take / p_quantity_issued), 4)`. Track running remainder so the last slice absorbs rounding drift.
- Insert each `stock_transactions` row with `secondary_quantity_change = -sec_take` and `secondary_uom` snapshot from `warehouse_items.secondary_uom`. Trigger fills `secondary_quantity_before/after`.
- `update warehouse_bin_allocations set secondary_quantity = greatest(0, coalesce(secondary_quantity,0) - sec_take)`.
- Validate available secondary at the location matches what the user typed (raise if shortage).
- Backwards-compatible: if the parameter is null, behave exactly as today.

### `process_material_return_stock_update`
Add `p_secondary_quantity_returned numeric default null`.
- Insert `stock_transactions` with `secondary_quantity_change = +p_secondary_quantity_returned`.
- `update warehouse_bin_allocations set secondary_quantity = coalesce(secondary_quantity,0) + p_secondary_quantity_returned` for the chosen/derived bin.
- No-op when null.

Both RPCs keep `SECURITY DEFINER` and `set search_path = public`.

## Type changes
- `src/types/materialIssueReturn.ts`
  - `CreateMaterialIssueItemData`: add `secondary_quantity_issued?: number; secondary_uom?: string | null;`
  - `MaterialReturnItem` + `CreateMaterialReturnItemData`: add `secondary_quantity_returned?: number; secondary_uom?: string | null;`

## Hook changes
- `src/hooks/useMaterialIssueItems.ts` — pass `p_secondary_quantity_issued: item.secondary_quantity_issued ?? null` to the RPC.
- `src/hooks/useMaterialReturns.ts` — pass `p_secondary_quantity_returned: item.secondary_quantity_returned ?? null` (read it from the inserted return-items row before calling the RPC).
- `src/components/warehouse/IssueItemsDialog.tsx` — same RPC call site updated to forward secondary qty when present.

## UI changes
Reuse the existing `DualQuantityInput` component.

### `CreateMaterialIssueDialog.tsx`
- Extend `IssueItem` row type with `secondary_quantity_issued?: number`, plus cached `track_secondary_quantity`, `secondary_uom`, and `available_secondary_stock` fetched alongside available base stock.
- Render an inline `DualQuantityInput` next to the quantity field for rows whose item has `track_secondary_quantity`. Show "available pcs" hint mirroring the existing available-stock helper.
- Validate: if secondary tracked, both base and secondary must be > 0; secondary cannot exceed `available_secondary_stock`.
- Pass `secondary_quantity_issued` + `secondary_uom` into `createItems(...)`.

### `CreateMaterialReturnDialog.tsx`
- Extend `ReturnItem` with `secondary_quantity_returned?: number`, `track_secondary_quantity`, `secondary_uom` (load from item lookup in `handleItemSelect`).
- Render `DualQuantityInput` next to the qty field when tracked.
- Persist via the updated `CreateMaterialReturnItemData`.

### Display surfaces (read-only, low-effort)
- `MaterialIssueDetailsDialog.tsx` and `MaterialReturnDetailsDialog.tsx` — show the secondary quantity using `formatDualQty` when present. (Existing ledger views already render secondary balances after the earlier dual-tracking work.)

## Validation rules
- Secondary inputs accept positive numbers only; zero or empty disables secondary writes for that line.
- For tracked items, refuse submit when secondary is missing while base > 0 (toast: "Pieces required for dual-tracked item X").
- Issue: client guard against `secondary > available_secondary_stock`; server raises authoritative error.

## Out of scope
- Backfilling secondary_quantity for legacy bin allocations or historical transactions.
- Changing valuation: base UOM remains the money/cost unit.
- Stock transfers, adjustments, cycle counts, reservations — separate follow-ups (mirrors the GRN-only rollout pattern).
- Per-piece variable dimensions (serial-style length per piece).

## Files touched
- New migration: alter tables + new versions of both RPCs
- `src/types/materialIssueReturn.ts`
- `src/hooks/useMaterialIssueItems.ts`
- `src/hooks/useMaterialReturns.ts`
- `src/components/warehouse/CreateMaterialIssueDialog.tsx`
- `src/components/warehouse/IssueItemsDialog.tsx`
- `src/components/warehouse/CreateMaterialReturnDialog.tsx`
- `src/components/warehouse/MaterialIssueDetailsDialog.tsx`
- `src/components/warehouse/MaterialReturnDetailsDialog.tsx`
