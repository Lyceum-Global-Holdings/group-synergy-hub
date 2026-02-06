# Plan: Stock Movement Report - COMPLETED ✓

## Changes Made

1. **Added Supplier Information to Stock Movement Report**
   - Updated `useStockMovementReport.ts` to fetch `supplier_id` from warehouse_items
   - Added supplier lookup from `suppliers` table
   - Added `supplier_name` to the `StockMovementReportItem` interface

2. **Updated Excel Export**
   - Added 'Supplier' column to `StockMovementReportDialog.tsx` export mapping
   - Column positioned after 'Brand' to match Item Master format

## Files Modified
- `src/hooks/useStockMovementReport.ts`
- `src/components/warehouse/StockMovementReportDialog.tsx`

## Excel Export Columns (Final)
| Column | Description |
|--------|-------------|
| Date/Time | Transaction timestamp |
| Transaction Type | Type of movement |
| Reference Type | Reference category |
| Reference ID | Reference identifier |
| Item Code | Item's code |
| Item Name | Item's name |
| Category | Item category |
| Brand | Item brand |
| Supplier | Item's default supplier |
| Qty Change | Quantity changed |
| Qty Before | Stock before transaction |
| Qty After | Stock after transaction |
| Unit Cost (LKR) | Cost per unit |
| Total Value (LKR) | Total transaction value |
| Issued To Location | Target location |
| Created By | User who created |
| Notes | Transaction notes |
