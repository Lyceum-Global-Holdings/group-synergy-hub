## Problem

`grn_items.item_code` and `item_name` are stored as `NULL` / empty string for some lines, so the Items tab renders `-` for Item Name and Code (verified for `GRN-20260612-001` — the row has `warehouse_item_id` set and the catalog resolves to `INV-RAW-000-0015 / Metal | Chips`, but the snapshot columns are blank).

Root cause: when a GRN is created from a PO line or via certain catalog-picker paths, the form sometimes only persists `warehouse_item_id` / `catalog_item_id` and leaves the denormalised `item_code` / `item_name` columns empty. The detail dialog reads those columns directly.

## Solution (SAP MM / ISO snapshot pattern)

A GRN line MUST carry an immutable snapshot of the item master at the moment of receipt (item code, name, UoM) — this is the international standard so historical receipts stay readable even if the master is later renamed or deleted. Enforce it server-side and self-heal existing rows.

### 1. DB trigger — `grn_items_fill_item_snapshot` (BEFORE INSERT OR UPDATE)

For every row, when `item_code`, `item_name`, or `unit_of_measure` is `NULL` or empty:

- Resolve the catalog row via `warehouse_item_id → warehouse_items.catalog_item_id → warehouse_item_catalog`, or directly via `catalog_item_id` if present.
- COALESCE-fill `item_code` from `warehouse_item_catalog.item_code`.
- COALESCE-fill `item_name` from `warehouse_item_catalog.name`.
- COALESCE-fill `unit_of_measure` from `item_units.code/name` joined through the catalog.

SECURITY DEFINER, `SET search_path = public`. Runs before the existing `enforce_grn_has_items` logic so approval transitions stay valid.

### 2. One-time backfill

`UPDATE grn_items SET ... FROM warehouse_item_catalog ... WHERE (item_code IS NULL OR item_code = '' OR item_name IS NULL OR item_name = '')` — uses the same resolution path as the trigger. Fixes `GRN-20260612-001` and any other historical rows.

### 3. Frontend defensive display

In `useGoodsReceiptNotes.ts` (both `useGoodsReceiptNotes` and `useGrnById`), extend the `grn_items(...)` embed with:

```
warehouse_item:warehouse_items(
  catalog:warehouse_item_catalog!warehouse_items_catalog_item_id_fkey(item_code, name)
)
```

In `GrnDetailsDialog.tsx` items table, render:

- `item.item_name || item.warehouse_item?.catalog?.name || '-'`
- `item.item_code || item.warehouse_item?.catalog?.item_code || '-'`

This guards against any future write path that forgets the snapshot, while the trigger remains the source of truth.

## Out of scope

- Changing GRN create/edit forms (the trigger fixes the data; forms can keep their current shape).
- Touching `unit_price` / pricing — covered by the prior price history work.
- Existing `enforce_grn_has_items` trigger — unchanged.

## Files

- New migration: `grn_items_snapshot_autofill.sql` (trigger + backfill).
- Edit: `src/hooks/useGoodsReceiptNotes.ts` (extend select).
- Edit: `src/components/warehouse/GrnDetailsDialog.tsx` (fallback rendering).
