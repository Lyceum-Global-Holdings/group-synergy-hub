Plan: implement location-scoped stock reconciliation using an international WMS/SAP EWM style rule: the operational balance is the SKU at physical location/bin, while item master stock is only the aggregate across locations.

What I will change

1. Make location inventory display location stock, not total item stock
- When a global warehouse location is selected, inventory rows will show the stock available in that selected location only.
- Example: if `INV-HAW-000-0389` has 163 in LAN and 20 in VEB, the LAN view will show 163 for LAN, not 183 total.
- The “current stock vs bin total” warning will compare against the selected location’s bin stock only, so it will not flag valid stock held in another location.

2. Fix reconciliation so it never pulls stock from other locations
- Update the reconciliation SQL/RPC so it accepts a `p_location_id` scope.
- For location-scoped reconciliation, it will:
  - calculate stock only from bins physically linked to that location,
  - adjust/create allocations only in bins at that location,
  - ignore bins and quantities at all other locations,
  - keep company isolation intact.
- The existing global reconciliation behavior will remain available only when no location scope is used, but the Inventory admin action already requires a selected location and will use the scoped path.

3. Fix Stock Audit to be location-aware
- Pass the selected global location into `stock_audit_summary`.
- When a location is selected, Stock Audit will report:
  - “Location Stock” = available quantity in that location,
  - “Bin Total” = allocations in bins at that same location,
  - variance only inside that location.
- Update labels/help text so users understand whether they are auditing global totals or a specific physical location.

4. Fix manual stock adjustments from movement history
- Ensure `StockAdjustmentDialog` persists `bin_id` into `stock_transactions`.
- Limit selectable bins to the selected/location-scoped bins when the adjustment is opened from location-scoped stock history.
- Calculate `quantity_before` and `quantity_after` from the chosen bin’s current allocation, not from the entire item master stock.
- This prevents new transactions from recreating wrong location/bin balances.

5. Remove/disable unsafe legacy repair actions
- The current client-side “Fix Allocations” logic moves allocations to the item master location and can destroy legitimate multi-location stock.
- I will replace it with a safer location-scoped migration/repair action or hide it from the inventory admin menu.
- “Fix from History” will also be constrained so it cannot create/update allocations outside the selected physical location.

6. Database hardening and backfill checks
- Add a migration that updates the relevant database functions, including:
  - `stock_audit_summary(...)`
  - `reconcile_stock_batch(...)`
  - location-scoped inventory support if needed
- Add/adjust indexes for efficient location-scoped allocation reads if missing.
- Add a targeted data consistency check for cases like `INV-HAW-000-0389` to verify no location reconciliation treats LAN + VEB/LNQ as one balance.

Technical standard to apply

```text
Correct stock unit of account:
(company_id, item_id, physical_location_id, bin_id)

Allowed aggregation:
item total = SUM(all bins for that item across all locations)

Forbidden reconciliation:
selected location stock = item total across all locations
```

Files/functions expected to change
- `src/hooks/useWarehouseItemsLazyInventory.ts`
- `src/components/warehouse/ItemMasterTab.tsx`
- `src/components/warehouse/StockAdjustmentDialog.tsx`
- `src/components/warehouse/StockAuditTab.tsx`
- `src/hooks/useStockAudit.ts`
- `src/hooks/useWarehouseBinAllocations.ts`
- `src/utils/stockReconciliation.ts`
- New Supabase migration for the location-scoped reconciliation/audit SQL

Validation after implementation
- Check `INV-HAW-000-0389`:
  - LAN shows/reconciles LAN bins only.
  - VEB shows/reconciles VEB bins only.
  - LNQ shows/reconciles LNQ bins only.
  - item master total remains the sum across all locations.
- Verify stock movement history only shows bins linked to the selected location.
- Verify new adjustments write the selected `bin_id` and location-correct balances.
- Check the runtime stack overflow seen in the preview and fix any project code path if it is reproducible after the stock changes.