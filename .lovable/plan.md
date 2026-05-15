## Goal

Let users register many partial pieces (offcuts/remnants) for a single parent item in one action, instead of repeating the dialog per piece. This mirrors SAP EWM "Handling Unit – multi-create" and Oracle WMS "multi-LPN receipt": one header (item + location + shared attrs) plus N detail rows (size/UOM/optional piece code/label).

## UX

Extend the existing **Add Partial Piece** dialog with a tab/toggle:

- **Single** (default, current behaviour — unchanged)
- **Multiple rows** (new)

In *Multiple rows* mode the dialog shows two zones:

**Header (shared across all rows)**
- Parent Item * (ItemSelector)
- Location * (locked to global header filter when active, same rule as single mode)
- Bin (optional, scoped to location)
- UOM * (defaults from item's secondary/base UOM)
- Unit cost, Source ref, Batch no., Label prefix, Notes — all optional, applied to every row

**Rows table** — editable grid with columns:
- # (auto)
- Size * (number, step 0.0001)
- Piece code (optional; blank = auto `ITEM-CODE/PQ-NNNN`)
- Label suffix (optional; final label = `prefix + suffix` when both present)
- Row actions: duplicate, remove

Controls under the table:
- "Add row" button
- "Paste from clipboard" — accepts CSV/TSV `size,piece_code,label` so users can paste from Excel (matches the existing import template column order)
- Row counter + sum of sizes (e.g. "12 rows · total 38.42 m")

Footer:
- Cancel
- **Add N pieces** — disabled until header valid and ≥1 row has a positive size

On submit: progress text "Saving 7 of 12…", then a single toast summarising successes / failures. On any failure the whole batch is rolled back (atomic — see Technical).

## Validation

- Header: parent item, location, UOM required.
- Each row: `size > 0` required.
- Piece codes within the batch must be unique (client-side check before submit).
- Empty rows are silently dropped.
- Max 200 rows per batch (UI guard) to keep the request bounded.

## Out of scope

- No changes to Edit / Consume / Split / CSV-Import dialogs.
- No new columns on `warehouse_partial_pieces`.
- No bulk edit / bulk delete.
- Single-mode behaviour and validation stay byte-identical.

## Files

- `src/components/warehouse/partial-qty/AddPartialPieceDialog.tsx` — add mode toggle, rows grid, paste handler, batch submit loop.
- `src/hooks/warehouse/usePartialPieces.ts` — add `useCreatePartialPiecesBulk` mutation that calls the new RPC and invalidates the same query keys as `useCreatePartialPiece`.
- New migration: `create_partial_pieces_bulk(p_company_id uuid, p_parent_item_id uuid, p_location_id uuid, p_bin_id uuid, p_shared jsonb, p_rows jsonb) returns setof uuid` — SECURITY INVOKER, runs all inserts inside one transaction by looping over `p_rows` and calling the existing `create_partial_piece` logic. Returns the new piece ids. RLS is enforced naturally because it's INVOKER.

## Technical notes

- Atomicity: a single RPC ensures all rows commit or none — required so a mid-batch failure doesn't leave the user with a partial save and duplicate piece codes on retry.
- Auto piece-code generation reuses the existing per-item sequence inside `create_partial_piece`; the bulk function calls that same code path so numbering stays gap-free per item.
- Cache invalidation: bulk mutation invalidates `["partial-pieces"]` and `["partial-piece-items"]` once after the whole batch (not per row) to avoid N refetches.
- Locked-location rule from the previous fix continues to apply — header location is pre-filled and disabled when the global filter is set, so all bulk rows land in the visible scope.

## Validation

1. Global filter cleared → open dialog → Multiple rows → add 3 sizes → save → 3 rows appear in the list under the same item code with sequential auto codes.
2. Sub-location selected globally → open dialog → header location is locked → save 5 rows → all 5 appear in the filtered list.
3. Paste `1.2\n2.4\n0.8` from Excel → 3 rows populated → save succeeds.
4. Force one row to duplicate an existing piece code → entire batch rejected, no partial inserts, error toast names the offending code.
