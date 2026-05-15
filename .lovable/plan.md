## Goal
Replace the free-text "UOM" input in the partial-pieces dialogs with a dropdown sourced from the same `item_units` master used by Item Master and Bin Master, so operators pick a standard unit instead of typing it.

## Scope
Frontend only. No DB / RLS / RPC changes. `partial_pieces.size_uom` continues to store the abbreviation string (e.g. `m`, `kg`), keeping all existing data and the bulk RPC payload compatible.

## Changes

**1. `src/components/warehouse/partial-qty/AddPartialPieceDialog.tsx`**
- Import `useItemUnits` and shadcn `Select`.
- Replace the UOM `<Input>` (line ~294) with a `<Select>` whose options are `units.map(u => u.abbreviation)` (label `"{name} ({abbreviation})"`), value bound to `sizeUom`.
- Auto-default behaviour preserved: when a parent item is picked, prefill `sizeUom` from `item.secondary_uom || item.base_uom` if that abbreviation exists in `units`; otherwise leave blank so the user must select.
- Applies to both **Single piece** and **Multiple rows** modes (UOM is in the shared header, so one change covers both).

**2. `src/components/warehouse/partial-qty/EditPartialPieceDialog.tsx`**
- Same replacement (line ~108–109). If the existing piece's `size_uom` isn't in the master list, render it as a disabled "legacy" option so the value stays visible and editable without data loss.

## Out of scope
- `ConsumePartialPieceDialog`, `SplitPartialPieceDialog` — they display UOM read-only, no input to convert.
- Bulk import template / CSV — already accepts free text; leaving as-is to avoid breaking existing templates.
- No schema changes to `partial_pieces` or the `create_partial_pieces_bulk` RPC.

## Validation
- Add dialog: pick an item with `base_uom = "m"` → UOM auto-selects `m`; user can change via dropdown; submit succeeds.
- Multiple-rows mode: UOM dropdown in shared header drives all rows.
- Edit dialog on a legacy piece with non-master UOM (e.g. `m²`): value remains selected and saveable.
