

# Restructure Item & Bin Master: Separate Item Master from Inventory

## Overview
Currently, the "Item Master" tab combines item definitions with live stock data. The plan is to split this into two distinct views and add a stock movement graph for visual analytics.

## Changes

### 1. Rename Existing Tab: "Item Master" becomes "Inventory"
- In `src/pages/warehouse/ItemBinMaster.tsx`, rename the first tab from "Item Master" to "Inventory"
- Update the page title to "Warehouse Management" (more encompassing)
- The existing `ItemMasterTab` component stays as-is (it already shows stock levels, bin allocations, movement history, adjustments) -- it IS the inventory view
- Expand the tab grid from 6 to 7 columns to accommodate the new tab

### 2. Create New "Item Master" Tab
Create `src/components/warehouse/ItemMasterDefinitionTab.tsx` -- a clean, focused view for item definitions/catalog:

**What it shows (table columns):**
- Photo, Item Code, Name, Description, Category, Unit, Brand, Manufacturer, Supplier, Barcode/SKU, Status, Unit Cost, Selling Price, Reorder Level, Min/Max Stock Levels

**Key features:**
- Search and filter by category, status, supplier
- Each row has a quick-link button to jump to that item's Inventory view (stock details) and Bin Master view (bin allocations)
- A "View Stock Movement" button per item that opens the existing `StockMovementDialog`
- Add/Edit item capabilities (reuses existing `AddItemsDialog`)

### 3. Stock Movement Graph
Add a stock movement trend chart at the top of the new Item Master tab (or as a collapsible section):

**Component:** `src/components/warehouse/StockMovementChart.tsx`

**What it displays:**
- A line/area chart (using Recharts, already installed) showing stock movement trends over the last 30 days
- X-axis: Date, Y-axis: Quantity
- Lines for: Goods Receipt (in), Material Issue (out), Transfers, Adjustments
- Data sourced from `stock_transactions` table, aggregated by day and transaction type
- A dropdown to filter by specific item or view all items combined

**Hook:** `src/hooks/useStockMovementAnalytics.ts`
- Queries `stock_transactions` for the last 30 days
- Groups by date and transaction_type
- Returns daily aggregated data for the chart

### 4. Updated Tab Layout in ItemBinMaster.tsx

```text
[Item Master] [Inventory] [Bin Master] [Bin Allocations] [Categories] [Units] [Stock Audit]
```

- "Item Master" (new) -- item catalog/definitions with links to stock data + graph
- "Inventory" (renamed from Item Master) -- live stock levels, adjustments, movements
- Rest stays the same

## Files to Create
- `src/components/warehouse/ItemMasterDefinitionTab.tsx` -- New Item Master catalog view
- `src/components/warehouse/StockMovementChart.tsx` -- Recharts-based movement graph
- `src/hooks/useStockMovementAnalytics.ts` -- Data hook for the graph

## Files to Modify
- `src/pages/warehouse/ItemBinMaster.tsx` -- Add new tab, rename existing, update grid layout

## Technical Notes
- The graph uses Recharts (`AreaChart` with multiple `Area` series), already a project dependency
- Stock movement data comes from the existing `stock_transactions` table (no schema changes needed)
- The new Item Master tab reuses existing dialogs (`AddItemsDialog`, `StockMovementDialog`, `ItemDetailsDialog`) to avoid duplication
- Navigation between tabs uses the existing `setActiveTab` state, so clicking "View in Inventory" from Item Master switches to the Inventory tab with the item pre-selected

