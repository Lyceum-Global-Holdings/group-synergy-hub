# Fix: Stock movement history not appearing after adjustments

## Root cause
`StockAdjustmentDialog.handleSubmit` inserts a `stock_transactions` row without `bin_id` or `location_id`:

```ts
createTransaction({
  item_id, transaction_type, reference_type,
  quantity_change, quantity_before, quantity_after,
  unit_cost, total_value, notes,
  issued_to_location_id,
});
```

DB confirms the two most recent adjustments today have `bin_id IS NULL` and `location_id IS NULL`.

The history dialog reads via `get_bin_scoped_stock_movements`, which is bin/location-scoped. With a `locationId` in scope (Inventory tab always passes one), rows with NULL bin_id AND NULL location_id are filtered out — so the new adjustment never appears in the user's history view.

## Fix (frontend only, `src/components/warehouse/StockAdjustmentDialog.tsx`)

Populate `bin_id` (and derived `location_id`) on the transaction insert:

1. Resolve the selected bin: `const selectedBin = bins.find(b => b.id === binId);`
2. Pass to `createTransaction`:
   - `bin_id: binId`
   - `location_id: selectedBin?.location_id ?? undefined`
3. No other call sites changed; the field is already in `CreateStockTransactionData` and on the `stock_transactions` table.

This makes the row visible to the bin-scoped reader for both bin-only and location-only scope filters.

## Out of scope
- No DB migration. The RPC and table already support the fields.
- No backfill of the two NULL-bin rows already inserted (they were created by the same bug; user can re-issue if needed, or we can write a one-off backfill if asked).
- No changes to GRN / transfer / picking writers (they already set bin_id/location_id).

## Files
- `src/components/warehouse/StockAdjustmentDialog.tsx`
