
# Plan: Add Item Master Excel Download for Admins

## Status: ✅ COMPLETED

## Overview
Add a "Download Item Master" button to the existing Admin Tools dropdown in the Item Master tab. This feature will export all warehouse items for the selected company (or all companies for super admins) to an Excel file.

## Implementation Details

### 1. Update ItemMasterTab Component

**File:** `src/components/warehouse/ItemMasterTab.tsx`

**Changes Made:**
- ✅ Added `Download` icon import from `lucide-react`
- ✅ Added `writeExcelFromJSON` import from `@/utils/excelUtils`
- ✅ Added `format` import from `date-fns` for filename formatting
- ✅ Added `toast` import from `sonner` for user feedback
- ✅ Created `handleDownloadItemMaster` function to prepare and export data
- ✅ Added new `DropdownMenuItem` in the Admin Tools dropdown

### 2. Export Data Structure

The Excel file includes these columns:
- Item Code
- Name  
- Description
- Category (resolved from category_id)
- Unit (resolved from unit_id)
- Brand
- Manufacturer
- Supplier (resolved from supplier relation)
- Bin(s) (comma-separated bin codes with quantities)
- Current Stock
- Unit Cost
- Selling Price
- Reorder Level
- Min Stock Level
- Max Stock Level
- Status
- Barcode
- SKU
- Company (for multi-company exports)

### 3. Access Control

- Feature is wrapped in `{canDelete && (...)}` check which validates admin/super_admin/moderator roles
- This follows the existing pattern used for other admin tools (Reconcile Stock, Fix Allocations, etc.)

### 4. User Experience

- Button appears in the Admin Tools dropdown with a Download icon
- Filename format: `item-master-{company-name}-{date}.xlsx` or `item-master-all-companies-{date}.xlsx`
- Toast notifications for success/error feedback
