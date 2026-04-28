## Goal

Allow decimal quantities when adding initial/opening stock (and across all warehouse stock entry points), aligned with international ERP conventions (SAP / Oracle EBS / ISO units of measure). Quantities like `12.5 kg`, `3.250 L`, `0.75 m` must be enterable, storable, and displayed accurately.

## Standard chosen

**3 decimal places** for quantities (precision `numeric(18,3)`):
- Matches SAP MM (`MENGE_D` = DEC 13,3) and Oracle EBS inventory transactions.
- Sufficient for kilograms/litres/metres without floating-point artefacts.
- Money/value fields stay at 2 decimals (unchanged).

Inputs that today force integers or `step="0.01"` will use `step="0.001"` with up to 3 decimals.

## What's wrong today

1. **DB columns are too narrow**: `warehouse_items.current_stock`, `warehouse_bin_allocations.allocated_quantity / reserved_quantity / available_quantity`, `finished_goods.current_stock`, `construction_inventory_stock.quantity` are all `numeric(15,2)` — only 2 decimals.
2. **Form inputs are inconsistent**:
   - `CreateItemDialog` / `SingleItemForm` initial stock: `step="0.01"` (2 dp only).
   - `AddPurchaseHistoryDialog` quantity: no `step` → integer-only spinner, placeholder `"0"`.
   - `CreateGrnDialog` `quantity_received` & `unit_price`: no `step` → integer spinner.
   - `ReceiveItemsDialog`: `step="0.01"`.
3. The min/max/reorder fields use `step="0.01"` but the underlying catalog columns are unconstrained `numeric` — already fine, just need UI consistency.

## Changes

### 1. Database migration (one migration)

Widen quantity columns to `numeric(18,3)`. Money columns (`unit_cost`, `selling_price`, `total_value`, `unit_price`) stay at their current `numeric(15,2)` / `numeric(18,2)`.

Tables/columns to alter:
- `warehouse_items.current_stock`, `reserved_quantity`
  - `available_quantity` is a generated column → drop & recreate after base columns change (per project memory on generated-column constraint).
- `warehouse_bin_allocations.allocated_quantity`, `reserved_quantity`
  - `available_quantity` (generated) → drop & recreate.
- `warehouse_item_reservations.reserved_quantity`
- `finished_goods.current_stock`
- `finished_goods_batches.quantity`
- `finished_goods_movements.quantity_change / quantity_before / quantity_after`
- `finished_goods_reservations.reserved_quantity`
- `construction_inventory_stock.quantity / reserved_quantity`
- `construction_inventory_master.quantity`
- `construction_inventory_transactions.quantity_change`
- `construction_repair_records.quantity`
- `construction_transfer_items.quantity`
- `pr_items.quantity`, `rfq_rfp_items.quantity`, `bom_items.quantity`, `project_budget_items.quantity` → bump to `numeric(18,3)`.

Out of scope (already adequate or different domain):
- `customer_invoice_lines.quantity` and `supplier_invoice_lines.quantity` already `numeric(18,4)` — leave as-is.
- `tool_adjustments.*` are `integer` (tools are counted units) — leave as-is.
- `stock_transactions.quantity_*` already unconstrained `numeric` — leave as-is.

### 2. Frontend — quantity input standard

Create a small helper `src/lib/quantityInput.ts` exporting:
```ts
export const QTY_STEP = "0.001";
export const QTY_DECIMALS = 3;
export const formatQty = (n: number | string | null | undefined) =>
  n == null || n === "" ? "" : Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 0, maximumFractionDigits: QTY_DECIMALS,
  });
```

Update every quantity `<Input type="number">` to use `step={QTY_STEP}` and `min="0"`:
- `src/components/warehouse/CreateItemDialog.tsx` (initial stock)
- `src/components/warehouse/SingleItemForm.tsx` (initial stock)
- `src/components/warehouse/AddPurchaseHistoryDialog.tsx` (quantity_purchased — currently integer)
- `src/components/warehouse/CreateGrnDialog.tsx` (quantity_received)
- `src/components/warehouse/ReceiveItemsDialog.tsx` (receivedQty)
- `src/components/warehouse/BulkStockUploadDialog.tsx` — already uses `parseFloat`; update CSV template comment to clarify decimals are accepted (`"50.250"`).

Replace any `parseInt(value)` for quantity reads with `parseFloat(value)` (audit while editing).

### 3. Display formatting

Where we render quantities (BinMasterTab, BinAllocationsTab, item lists), use `formatQty()` so trailing zeros are trimmed (`12` not `12.000`, but `12.5` shows as `12.5`).

## Out of scope

- No change to UoM master, no change to per-item decimal precision (could be a future enhancement: per-UoM `decimal_places`).
- Reports/exports already pass numeric values through; no formatting change needed beyond what the helper provides.

## Risk & rollback

- Widening `numeric(15,2)` → `numeric(18,3)` is a non-lossy `ALTER COLUMN TYPE` and safe on existing data.
- Generated columns (`available_quantity`) must be dropped before altering and recreated after — handled inside the same migration in a single transaction.
- No RLS/policy changes.
