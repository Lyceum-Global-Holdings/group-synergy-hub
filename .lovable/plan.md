## Goal

Reduce operator mistakes in the Partial Piece dialogs by clearly surfacing the relationship between the **selected size UOM** and the parent item's **base UOM** (the canonical unit used for valuation/FIFO).

This is presentation-only — no schema changes, no business-logic changes.

## Background

Per the project's `dual-quantity-tracking` architecture memory, items have a `base_uom` (canonical) and an optional `secondary_uom` (counted). Conversions are **per-receipt, not fixed** (cut sizes vary), so there is no fixed conversion factor to display. The fix is therefore to show the *relationship* and the correct convention, not a hardcoded factor.

## What the user will see

A small helper line appears directly **under the UOM Select** in both dialogs once a parent item is known:

- **Same as base** — when `sizeUom === item.base_uom`:
  `✓ Matches base UOM (1 {uom} = 1 {uom}) — used for valuation & FIFO`
- **Tracked secondary UOM** — when `sizeUom === item.secondary_uom` and `item.track_secondary_quantity` is true:
  `Per-receipt conversion to base UOM ({base_uom}). Captured per GRN — varies by cut.`
- **Other / mismatched** — when `sizeUom` is neither base nor tracked secondary:
  `⚠ Not the item's base ({base_uom}) or tracked secondary ({secondary_uom}). Confirm this is correct.` (warning tone, `text-warning`/amber)
- **No item picked yet** — line is hidden.

This pattern matches SAP MM and Oracle Inventory dialogs that always echo the alternate UOM beside the entered one.

## Files

1. `src/components/warehouse/partial-qty/AddPartialPieceDialog.tsx`
   - Already has `item` (with `base_uom`, `secondary_uom`, `track_secondary_quantity` — extend the local `item` memo type) and `sizeUom`.
   - Add a `<UomConversionHint>` block under the UOM `<Select>` in the shared header.

2. `src/components/warehouse/partial-qty/EditPartialPieceDialog.tsx`
   - Currently doesn't load the parent item's master record. Use the existing `piece.base_uom` field on `PartialPieceRow` (already present) — that's enough; no new query needed. Show:
     - `✓ Matches base UOM` when `sizeUom === piece.base_uom`
     - `⚠ Differs from base UOM ({piece.base_uom})` otherwise.

3. `src/components/warehouse/partial-qty/UomConversionHint.tsx` *(new, ~30 lines)*
   - Small presentational component. Props: `selectedUom`, `baseUom`, `secondaryUom?`, `trackSecondary?`. Returns the appropriate hint line with an icon and semantic token color (`text-muted-foreground` / `text-warning` / `text-success`). No conversion math — uses semantic tokens only.

## Out of scope

- No new conversion-factor table or migration.
- No changes to Consume / Split / Bulk import dialogs.
- No changes to save payloads or validation rules.
