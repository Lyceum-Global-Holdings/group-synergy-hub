
# Stock Audit View for Warehouse Module

## What This Does

Adds a new "Stock Audit" tab to the Item & Bin Master page (`/warehouse/item-bin-master`) that compares `warehouse_items.current_stock` against the sum of all bin allocation quantities for each item. Any discrepancy (desync) is surfaced clearly so it can be investigated or fixed.

## Current State (Confirmed by Database)

There are currently 4 desynced items that will immediately appear in the audit view:

| Item | Item Code | Current Stock | Bin Total | Desync |
|---|---|---|---|---|
| Size Lable | SizeLable | 910 | 1,000 | -90 |
| Waistband stripe White | WaistbandstripeW | 60 | 100 | -40 |
| zipper 8in Gray | 8zipperG | 993 | 1,000 | -7 |
| Draw code 50" | Drawcode50 | 1 | 0 (no bins) | +1 |

## Where It Fits

The new tab is added to the existing `ItemBinMaster` page alongside the 5 current tabs (Item Master, Bin Master, Bin Allocations, Categories, Units). The tab grid will expand from 5 to 6 columns.

## Changes Required

### 1. New Hook: `src/hooks/useStockAudit.ts`

A dedicated React Query hook that fetches all items with their bin allocation sums and computes the desync:

```typescript
// Fetches from warehouse_items with a join to sum warehouse_bin_allocations
// Returns items where current_stock != SUM(allocated_quantity)
// Also tracks items with NO bin allocations but non-zero stock (unmanaged items)
```

The query will:
- Fetch all active `warehouse_items` for the selected company
- For each item, fetch the sum of `warehouse_bin_allocations.allocated_quantity`
- Compute: `desync = current_stock - bin_total`
- Classify each item as `'ok'`, `'desync'`, or `'no_bins'`

### 2. New Component: `src/components/warehouse/StockAuditTab.tsx`

A self-contained tab component with:

**Summary Cards Row (3 cards)**
- Total items audited
- Items with desync (highlighted red if > 0)
- Items with no bin allocations (highlighted amber)

**Audit Table**
Columns: Item Code | Item Name | Current Stock (Item Master) | Bin Total (Sum of Allocations) | Variance | Bins Count | Status

Status badge:
- `In Sync` (green) — current_stock == bin_total
- `Desynced` (red) — current_stock != bin_total
- `No Bins` (amber) — item has no bin allocations

**Filtering Controls**
- Search by item code or name
- Filter dropdown: All / Desynced Only / No Bins Only / In Sync Only

**Fix Desync Button** (Admin only)
- A "Fix Desync" button per desynced row triggers a targeted fix: it updates the bin allocation(s) for that item to match `current_stock` (similar to the existing `reconcileStockMutation` in `useWarehouseBinAllocations.ts` but scoped to a single item)
- A "Fix All" button at the top runs the same fix for all desynced items

**Refresh Button**
- Manually re-fetches the audit data

### 3. Update: `src/pages/warehouse/ItemBinMaster.tsx`

- Import `StockAuditTab`
- Add a 6th tab trigger: "Stock Audit" with a `ShieldAlert` icon
- Change `grid-cols-5` to `grid-cols-6` in TabsList

## Technical Details

### Hook Query Logic

```typescript
// Fetch items
const items = await supabase
  .from('warehouse_items')
  .select('id, item_code, name, current_stock, company_id, status')
  .eq('company_id', selectedCompany.id)
  .eq('status', 'active');

// Fetch bin allocations
const allocations = await supabase
  .from('warehouse_bin_allocations')
  .select('warehouse_item_id, allocated_quantity');

// Group allocations by item id, compute sum, then join
```

### Single-Item Fix Logic

The fix for a desynced item:
- If item has existing bin allocations → update the primary (largest) allocation so `SUM = current_stock`
- If item has no bins at all → show warning; user must create a bin allocation manually via the Bin Allocations tab

### Admin Guard

The fix buttons use the existing `useIsAdminOrHigher` hook — only admins can trigger fixes, but all users can view the audit.

## Files to Create/Edit

| File | Action |
|---|---|
| `src/hooks/useStockAudit.ts` | Create — new data hook |
| `src/components/warehouse/StockAuditTab.tsx` | Create — new tab component |
| `src/pages/warehouse/ItemBinMaster.tsx` | Edit — add 6th tab |
