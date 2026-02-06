

# Plan: Add Stock Adjustment Functionality to Stock Transfer Page

## Overview
Add stock adjustment capabilities to the Stock Transfer page, making it a more comprehensive inventory management hub for administrators. This includes quick/bulk adjustment options and access to the Stock Movement Report.

## Current State
- Stock Transfer page (`/warehouse/stock-transfer`) only handles transfers between locations
- Stock adjustments exist on a separate page (`/warehouse/stock-adjustment`)
- Stock Movement Report dialog was recently added to Item Master tab

## Proposed Solution
Add an "Admin Tools" dropdown to the Stock Transfer page header (for admin roles and above) that provides:
1. **Quick Adjustment** - Single item stock adjustment
2. **Bulk Adjustment** - Multi-item batch adjustments  
3. **Stock Movement Report** - Generate Excel reports for any date range

## Implementation Details

### 1. Update Stock Transfer Page

**File:** `src/pages/warehouse/StockTransfer.tsx`

**Changes:**
- Add imports for admin tools components and hooks:
  - `useIsAdminOrHigher` hook for role checking
  - `StockAdjustmentDialog` component
  - `BulkAdjustmentDialog` component
  - `StockMovementReportDialog` component
  - `DropdownMenu` components from UI library
  - Icons: `Settings2`, `FileSpreadsheet`, `Wrench`
- Add state variables for dialog visibility:
  - `showQuickAdjustmentDialog`
  - `showBulkAdjustmentDialog`
  - `showMovementReportDialog`
- Add Admin Tools dropdown in the header alongside "Create Transfer" button
- Render the dialog components

### 2. UI Layout

The Admin Tools dropdown will appear next to the "Create Transfer" button for authorized users:

```
Stock Transfer                    [Admin Tools ▾] [+ Create Transfer]
Manage stock transfers...         ├─ Quick Adjustment
                                  ├─ Bulk Adjustment
                                  └─ Stock Movement Report
```

### 3. Access Control

- Admin Tools dropdown only visible when `canDelete` is true (from `useIsAdminOrHigher`)
- This includes users with roles:
  - admin
  - super_admin
  - moderator

### 4. Dialog Integration

**Quick Adjustment Dialog:**
- Reuse existing `StockAdjustmentDialog` component
- Opens with empty/default item (user selects item within dialog)
- Note: The current StockAdjustmentDialog requires an itemId, so we'll need to handle the "no item selected" case or use a modified approach

**Alternative for Quick Adjustment:**
- Navigate to the Stock Adjustment page instead of opening a dialog
- OR create a simplified "Quick Adjustment" that lets user select item first

**Bulk Adjustment Dialog:**
- Reuse existing `BulkAdjustmentDialog` component
- Full 3-step workflow: Setup → Add Items → Review & Submit

**Stock Movement Report Dialog:**
- Reuse existing `StockMovementReportDialog` component
- Same functionality as in Item Master tab

## Technical Notes

- All dialogs already exist and are tested
- No database changes required
- No new dependencies needed
- Follows existing patterns from Item Master tab
- Company context automatically applied through existing hooks

## Files to Modify

1. `src/pages/warehouse/StockTransfer.tsx` - Add Admin Tools dropdown and dialog integrations

## User Experience

1. Admin navigates to Stock Transfer page
2. Sees "Admin Tools" dropdown next to "Create Transfer" button
3. Can access:
   - Quick adjustments for individual items
   - Bulk adjustments for multiple items
   - Stock movement reports for any date range
4. All functionality respects company context and permissions

