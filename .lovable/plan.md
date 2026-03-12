

# Daily Production Summary Dashboard

## What We're Building

A new "Daily Summary" tab in the Production module that shows aggregated production output across all orders and stages for a selected date. Users pick a date and see total input, output, and wastage broken down by order and stage.

## Changes

### 1. New hook: `useDailySummary(date)` in `useProduction.ts`

Query `production_daily_entries` filtered by `entry_date`, joining `production_order_stages` and `production_orders` to get order number, product name, and stage name. Returns all entries for that date with their parent context.

### 2. New component: `DailyProductionSummary.tsx`

- Date picker (defaults to today) at the top
- KPI row: Total Input, Total Output, Total Wastage for the selected date
- Table grouped by production order showing per-stage entries (stage name, input, output, wastage, notes)
- Bar chart showing output by stage name (aggregated across orders)
- Empty state when no entries exist for the selected date

### 3. Add tab to `ProductionModule.tsx`

Add a "Daily Summary" tab alongside Dashboard and Production Orders tabs, rendering the new `DailyProductionSummary` component.

### No database changes needed

The `production_daily_entries` table already has `entry_date` and `stage_id` with the necessary relationships.

