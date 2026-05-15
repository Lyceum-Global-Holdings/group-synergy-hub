# Link Partial Pieces with Item Code

Refactor Partial Pieces so the parent **item_code** drives identification, search, and auto-numbering — aligning with GS1 Variable Measure Trade Item conventions.

## 1. Auto piece-code format (GS1-aligned)

Replace `PQ-YYYYMMDD-NNNN` with a code derived from the parent item:

```text
{ITEM_CODE}/PQ-{NNNN}
```

- `NNNN` = zero-padded next sequence per `(company_id, parent_item_id)`.
- Example: parent `WIRE-CU-2.5` → first piece `WIRE-CU-2.5/PQ-0001`.
- Manual `piece_code` still allowed; uniqueness stays `(company_id, piece_code)`.
- Splits/residuals derive from the same parent item code, continuing the per-item sequence.
- Rationale: mirrors GS1 CBV "variable measure trade item" (parent GTIN + serialized suffix) and SAP IS-Mill remnant numbering.

## 2. Item picker (type-ahead) for dialogs

Replace the plain `Select` of warehouse items in **Add / Edit / Split / Consume** dialogs with a searchable combobox:

- Searches both `item_code` and `item_name` server-side via the existing `list_warehouse_inventory` RPC (debounced, capped page size).
- Displays `ITEM_CODE — Item Name (UOM / Secondary UOM)`.
- Default `size_uom` from selected item's `secondary_uom` (existing behaviour preserved).
- Reuses the project's hybrid Picker UX pattern (memory: Picker UX Hybrid Strategy).

## 3. Toolbar item filter

Add an **Item** filter dropdown next to the existing Status filter:

- Populated only with items that already have at least one partial piece (distinct `parent_item_id` from `list_partial_pieces`).
- Sorted by item_code; shows `code — name`.
- "All items" default. Filter is applied server-side in `list_partial_pieces` (new optional `p_parent_item_id` arg).

## 4. Item code visibility everywhere

- Grid: add **Item Code** column (left of Item Name); make it monospace + bold, sortable.
- Search box: searches `piece_code`, `label`, `item_code`, `item_name`.
- Detail dialogs: show item_code prominently above name.
- CSV export & import template: add `item_code` column. On import, accept either `item_code` (preferred) or `parent_item_id`; resolve to UUID server-side, error if both missing or conflicting.

## 5. Backend changes

New migration:

- `generate_partial_piece_code(p_company_id, p_parent_item_id) RETURNS text` — atomic per-item sequence using `SELECT ... FOR UPDATE` on a new helper table `partial_piece_sequences(company_id, parent_item_id, last_seq)` (or `MAX(seq)` derived; sequence table is safer under concurrency).
- Update `create_partial_piece` & `split_partial_piece` to call the new generator when `piece_code` is blank.
- Update `list_partial_pieces` to accept optional `p_parent_item_id` filter and return `item_code` (already returned — verify) for the grid.
- Update `import_partial_pieces` to resolve `item_code → parent_item_id` per row.

## 6. Frontend changes

- New `ItemCodePicker` component (or reuse existing inventory picker) wired to `list_warehouse_inventory`.
- Update `AddPartialPieceDialog`, `EditPartialPieceDialog`, `SplitPartialPieceDialog`, `ConsumePartialPieceDialog` to use the picker.
- Update `PartialQuantities.tsx` grid columns, toolbar filter, search predicate, CSV export.
- Update `importTemplate.ts` & `ImportPartialPiecesDialog.tsx` to expect `item_code`.
- `usePartialPieces.ts`: add `parent_item_id` filter param.

## Out of scope

- Changing existing piece codes already in the database (new format applies forward only).
- Barcode/GS1-128 label printing (separate feature).
- Cross-company item references.

## Files

**New**
- `src/components/warehouse/partial-qty/ItemCodePicker.tsx`
- One new SQL migration (sequence table, generator, RPC updates)

**Edited**
- `src/pages/warehouse/PartialQuantities.tsx`
- `src/components/warehouse/partial-qty/AddPartialPieceDialog.tsx`
- `src/components/warehouse/partial-qty/EditPartialPieceDialog.tsx`
- `src/components/warehouse/partial-qty/SplitPartialPieceDialog.tsx`
- `src/components/warehouse/partial-qty/ConsumePartialPieceDialog.tsx`
- `src/components/warehouse/partial-qty/ImportPartialPiecesDialog.tsx`
- `src/components/warehouse/partial-qty/importTemplate.ts`
- `src/hooks/warehouse/usePartialPieces.ts`
- `src/integrations/supabase/types.ts` (auto)
