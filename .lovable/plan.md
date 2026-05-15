## Goal
On the Partial Pieces page, group rows that share the same parent item code into a single collapsible parent row showing aggregated totals, while keeping each individual piece accessible (expand to see, and all per-piece actions still work). This matches GS1 / WMS practice where a logistic unit (item / SKU) is the natural roll-up for its sub-units (offcut pieces).

## Why this approach (international standards)
- **GS1 hierarchy** — Each partial piece is a sub-unit of a parent trade item (GTIN / item code). Aggregating sub-units under their parent trade item is the standard "aggregation event" view in EPCIS / GS1 logistics.
- **WMS convention (SAP EWM, Oracle WMS, Manhattan)** — "Handling unit" or "remnant" lists show one row per material with totals (count + summed quantity per UoM), and drill down to individual pieces / serial numbers. We mirror that.
- **No data merging** — Pieces stay physically distinct rows in `partial_pieces` (each remnant has its own piece_code, location, bin, batch, cost, age). Combining only happens in the UI as a presentational roll-up. This preserves traceability, FIFO, and audit trail — required by ISO 9001 / GS1 EPCIS. We do **not** physically merge pieces (that would destroy lot/serial traceability, which is the whole point of remnant tracking).

## Scope
Frontend only. No DB / RPC / RLS changes. `usePartialPieces` keeps returning flat rows; grouping happens in `PartialQuantities.tsx`.

## Changes

### 1. `src/pages/warehouse/PartialQuantities.tsx`
- Add a **view toggle** in the toolbar: `Grouped by item` (default) ↔ `Flat list`. Persist choice in `localStorage` (`partial-pieces-view-mode`).
- Build groups in a `useMemo` keyed by `parent_item_id`:
  - `parent_item_code`, `parent_item_name`, `base_uom`
  - `piece_count`
  - `totals_by_uom`: `Record<uom, number>` — sum of `size_value` per `size_uom` (different UoMs are kept separate; never silently summed across incompatible units — ISO 80000 / GS1 rule)
  - `available_count`, `reserved_count`, `consumed_count`, `scrapped_count`
  - `locations`: distinct count of `location_id`
  - `oldest_age_days`: max age (FIFO indicator)
  - `pieces`: the original `PartialPieceRow[]`
- Render with the existing `VirtualTable` in two modes:
  - **Grouped mode**: render parent rows. Each parent row uses a chevron button to toggle expansion; expanded rows render the original child columns (Piece Code, Size, Location/Bin, Status, Source, Age, Actions) inline beneath. Track expanded set in component state (`Set<string>` of parent_item_id), with "Expand all / Collapse all" buttons.
  - **Flat mode**: current behaviour, unchanged.
- Parent-row columns:
  1. Chevron + Parent Item (code mono + name)
  2. Pieces (count, with status mini-breakdown e.g. "12 (10 avail · 2 res)")
  3. Total quantity — rendered as `"125.40 m, 3.00 kg"` when multiple UoMs are present (each on its own line); single-UoM items show one value
  4. Locations (distinct count)
  5. Oldest age (days) — FIFO hint
  6. Actions on parent: `Add piece` (opens `AddPartialPieceDialog` pre-filled with this parent item)
- Search and the existing status / parent-item / location filters apply **before** grouping, so a filtered result regroups naturally.
- Export CSV stays per-piece (auditable raw data). Add a second export option `Export summary` only in grouped mode — one row per parent item with totals per UoM serialized as `"125.40 m; 3.00 kg"`.

### 2. `AddPartialPieceDialog.tsx` — minor
Accept an optional `defaultParentItemId` prop so the parent-row "Add piece" action can pre-select the item. No behaviour change when prop is omitted.

## Out of scope
- DB-level merging of pieces (would destroy lot / serial traceability — explicitly avoided).
- Cross-UoM unit conversion (e.g. mm → m). Standard practice is to display each UoM separately; conversion belongs in a dedicated UoM-conversion service, not in a list view.
- Changes to Add / Edit / Consume / Split / Import dialogs beyond the one optional prop above.

## Validation
- Three pieces of `WIRE-001` (2.5 m, 3.0 m, 1.2 m) → one parent row "WIRE-001 · 3 pieces · 6.70 m". Expand → see each piece with its own code, bin, age, actions.
- Mixed-UoM item (2 pieces in `m`, 1 piece in `kg`) → parent total renders both lines: `"5.00 m"` and `"3.00 kg"`. No silent summing.
- Filter status = `available` → groups recompute from the filtered set; counts reflect only available pieces.
- Toggle to Flat mode → original table renders identically to today.
- Per-piece Edit / Consume / Split actions inside an expanded group still open the same dialogs and refresh the list.
