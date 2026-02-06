
# Plan: Stock Movement Report Generation Feature

## Overview
Add a comprehensive Stock Movement Report generation feature that allows administrators to export detailed stock transaction data for any specified time period. The report will be accessible from the Item Master tab's Admin Tools dropdown and will include all stock movements with resolved item details, categorization, and value calculations.

## Solution Architecture

The best approach is to create a dedicated dialog component that:
1. Allows selecting a date range (from/to dates)
2. Provides optional filters (transaction type, category, item)
3. Generates a comprehensive Excel report with all movement details
4. Is restricted to admin roles and above

## Implementation Details

### 1. Create Stock Movement Report Dialog Component

**File:** `src/components/warehouse/StockMovementReportDialog.tsx`

**Features:**
- Date range picker (Start Date / End Date inputs)
- Optional filters for:
  - Transaction Type (all/specific types)
  - Category filter
  - Item search/filter
- Loading state while fetching data
- Export to Excel functionality

**Form Fields:**
- Start Date (required)
- End Date (required)
- Transaction Type filter (optional - dropdown)
- Category filter (optional - dropdown)

### 2. Create Hook for Date-Filtered Stock Transactions

**File:** `src/hooks/useStockMovementReport.ts`

**Functionality:**
- Accept date range parameters
- Query `stock_transactions` table with date filters
- Join with `warehouse_items` table to get item details
- Join with `item_categories` to get category names
- Join with `profiles_directory` to get user names
- Return formatted data ready for export

**Query Structure:**
```sql
SELECT st.*, 
       wi.item_code, wi.name as item_name, wi.brand,
       ic.name as category_name,
       pd.full_name as created_by_name
FROM stock_transactions st
LEFT JOIN warehouse_items wi ON st.item_id = wi.id
LEFT JOIN item_categories ic ON wi.category_id = ic.id
LEFT JOIN profiles_directory pd ON st.created_by = pd.user_id
WHERE st.created_at >= start_date 
  AND st.created_at <= end_date
ORDER BY st.created_at DESC
```

### 3. Update ItemMasterTab Component

**File:** `src/components/warehouse/ItemMasterTab.tsx`

**Changes:**
- Import `StockMovementReportDialog`
- Add state for dialog visibility
- Add menu item in Admin Tools dropdown with `FileSpreadsheet` icon
- Wire up dialog open/close

### 4. Excel Export Data Structure

The report will include these columns:
- Date/Time
- Transaction Type
- Reference Type
- Reference ID
- Item Code
- Item Name
- Category
- Brand
- Qty Change
- Qty Before
- Qty After
- Unit Cost (LKR)
- Total Value (LKR)
- Issued To Location
- Created By
- Notes

### 5. Access Control

- The dialog trigger is wrapped in the existing `{canDelete && (...)}` check
- This uses the `useIsAdminOrHigher` hook which validates:
  - admin role
  - super_admin role
  - moderator role
- No additional access control changes needed

## Component Flow

```text
User clicks "Stock Movement Report" in Admin Tools dropdown
                    |
                    v
    StockMovementReportDialog opens
                    |
                    v
    User selects date range + optional filters
                    |
                    v
    User clicks "Generate Report"
                    |
                    v
    useStockMovementReport hook fetches data with filters
                    |
                    v
    Data is transformed to export format
                    |
                    v
    writeExcelFromJSON creates and downloads the Excel file
                    |
                    v
    Success toast notification
```

## Files to Create
1. `src/components/warehouse/StockMovementReportDialog.tsx` - Main dialog component
2. `src/hooks/useStockMovementReport.ts` - Data fetching hook with date filtering

## Files to Modify
1. `src/components/warehouse/ItemMasterTab.tsx` - Add dialog trigger and state

## Technical Notes

- Uses existing `writeExcelFromJSON` from `@/utils/excelUtils.ts`
- Follows existing dialog patterns (e.g., `GenerateReportDialog`)
- Uses native HTML date inputs for simplicity (matching existing patterns)
- Transaction type labels reused from `StockMovementDialog.tsx`
- Company filtering applied automatically via the existing data context
- Date filtering uses ISO date strings with timezone handling

## User Experience

1. Admin navigates to Item & Bin Master page
2. Clicks "Admin Tools" dropdown
3. Selects "Stock Movement Report"
4. Dialog opens with:
   - Start Date (defaults to 30 days ago)
   - End Date (defaults to today)
   - Optional Transaction Type filter
   - Optional Category filter
5. User adjusts dates/filters as needed
6. Clicks "Generate Report"
7. Excel file downloads automatically
8. Success toast confirms the export

## Security Considerations

- Feature only accessible to admin/super_admin/moderator roles
- Data export respects existing company filtering
- No new database permissions required (uses authenticated role)
- Audit trail maintained through existing stock_transactions records
