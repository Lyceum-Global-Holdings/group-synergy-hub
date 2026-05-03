I will fix this by making the physical bin location the source of truth for all inventory movement history, matching SAP EWM / Oracle WMS standards: stock is tracked as a warehouse quant at `item + location + bin`, not as one merged item balance.

## What is currently wrong

For `INV-HAW-000-0389`, the database shows the root cause clearly:

- LAN item has total stock `183`.
- Its current allocations are:
  - `LAN` bin at LAN = `163`
  - `4-A-2-2` bin at VEB = `20`
- The stock movement row for `4-A-2-2` is still recorded with transaction `location_id = LAN`, because the trigger forces transaction location from `warehouse_items.location_id` instead of the bin’s real location.
- The movement quantities are item-total quantities, e.g. `163 -> 183`, instead of bin-level quantities, which should be `0 -> 20` for bin `4-A-2-2`.
- One LAN adjustment row has no `bin_id`, so LAN history misses the `+55` unless we backfill it to the LAN bin.

So the visible issue is not just UI filtering. The ledger itself is storing/using the wrong physical scope.

## Implementation plan

### 1. Make bin location the authoritative physical location

Update the `stock_transactions_location_guard` database trigger so that:

- If `bin_id` is provided, `stock_transactions.location_id` is set from `warehouse_bins.location_id`.
- The trigger rejects a `bin_id` that is not allocated to the same item.
- The trigger no longer permits cross-location bin data under the item’s default location.
- If `bin_id` is missing and the item has exactly one allocated bin in the relevant location, it auto-fills that bin and location.
- If multiple bins exist and no bin is provided, it stays unresolved/blocked depending on writer context, so the system does not guess silently.

This makes the physical bin/location relationship canonical.

### 2. Repair existing stock transaction data

Run a data correction for existing rows:

- For every transaction with `bin_id`, set `stock_transactions.location_id = warehouse_bins.location_id`.
- For `NULL bin_id` transactions, backfill only when deterministic:
  - Parse notes like `Bin: LAN`, `Bin: 4-A-2-2`, etc.
  - Or if the item has exactly one allocation in that transaction’s location, assign that bin.
  - Leave ambiguous rows as unassigned rather than guessing.
- Recompute `quantity_before` and `quantity_after` chronologically per `(item_id, bin_id)` for bin-resolved transactions.

For the example item this will make:

```text
LAN bin:
0 -> 108
108 -> 163

VEB / 4-A-2-2 bin:
0 -> 20
```

instead of showing the VEB bin inside LAN as `163 -> 183`.

### 3. Stop stock transactions from overwriting master stock incorrectly

There are two existing triggers that set `warehouse_items.current_stock = stock_transactions.quantity_after`. That is dangerous now because movement quantities must be bin-level, not total item-level.

I will change the stock architecture so:

- `warehouse_bin_allocations` remains the stock source of truth.
- `warehouse_items.current_stock` is synchronized from `SUM(warehouse_bin_allocations.allocated_quantity)`.
- `stock_transactions` becomes the immutable audit ledger and no longer overwrites item stock from a row-level `quantity_after`.

This prevents a single bin transaction from changing the total item stock incorrectly.

### 4. Update stock movement history reader to use bin-scoped quantities

Create/use a canonical stock movement history query/RPC that:

- Filters by actual bin location, not item master location.
- Computes `quantity_before` and `quantity_after` using window functions per `(item_id, bin_id)`.
- Returns bin code, bin name, physical location, and computed bin balance.
- Excludes cross-location bins when a location is selected.

This means the UI will no longer trust historically wrong stored item-total before/after values.

### 5. Fix Stock Movement History dialog behavior

Update `StockMovementDialog` so when a location is selected:

- It only loads bins whose `warehouse_bins.location_id` equals the selected location.
- It does not show cross-location bins in that location’s history.
- It defaults to the first relevant bin when multiple bins exist, instead of silently showing all bins.
- “All bins” means only all bins under the selected location, not all bins for the item everywhere.
- It displays the physical location/bin clearly in the table.
- The quantity columns show bin-level running balances.

For `INV-HAW-000-0389`:

- Selecting LAN shows only LAN bin history and LAN quantity.
- Selecting VEB shows `4-A-2-2` history and quantity `20`.
- LAN will not show `4-A-2-2`.

### 6. Fix all stock writers to write bin-level ledger rows

Update writers so every stock movement records `bin_id` and bin-level before/after quantities:

- Bulk stock upload
- Manual stock adjustment
- Opening stock on item creation/import
- GRN approval/bin allocation
- Material issue/MIN issuance
- Material returns
- Stock transfers
- Cycle counts / stock audits
- Putaway or other warehouse flows that create `stock_transactions`

Key rule:

```text
quantity_before = quantity in this exact bin before movement
quantity_after  = quantity in this exact bin after movement
```

Not the total item stock across all bins.

### 7. Fix inventory page context propagation

When the global location selector is active:

- Inventory row quantities should be derived from bins at that selected location.
- Opening history/adjustment from that row should pass the selected location context.
- Adjustment bin selector should only show bins linked to the selected location.
- Stock details and recent history should not show bins from other locations.

### 8. Fix reports and analytics using stock movements

Update these areas to use the same bin-scoped source:

- `ItemDetailsDialog` recent stock history and chart
- Stock Movement Report export
- Stock Movement Analytics
- Inventory valuation movement analysis where applicable

Reports will include bin code/location and computed bin before/after quantities so exported Excel does not repeat the wrong totals.

### 9. Add diagnostics and safeguards

Add diagnostic checks/views for admins:

- Transactions with `bin_id` whose transaction location does not match the bin location.
- Transactions missing `bin_id` where the item has multiple bins.
- Transactions whose stored before/after differs from computed bin-level running balance.
- Allocations where item default location differs from bin physical location, shown as a data-quality warning rather than used for filtering.

### 10. Update architecture memory/documentation

Update the project rule to state:

- Physical stock location comes from `warehouse_bins.location_id`.
- `warehouse_items.location_id` is not allowed to decide movement history when `bin_id` exists.
- Movement history quantity columns are bin-level balances.
- Location-selected screens must show only bins physically linked to that location.

## Validation after implementation

I will verify using `INV-HAW-000-0389`:

- LAN selected: only LAN bin appears; quantity history ends at `163`.
- VEB selected: only `4-A-2-2` appears; quantity history ends at `20`.
- LNQ selected: only `LNQ-BOX` appears; quantity history ends at `24.5`.
- No location selected: histories may roll up by bin, but each row still shows the correct physical bin/location and bin-level quantities.

This is the cleanest standards-based fix because it corrects the database ledger, the trigger rules, the writers, and every reader/report instead of only hiding the issue in one screen.