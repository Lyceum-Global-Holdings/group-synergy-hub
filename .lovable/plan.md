

# Restructure Item Master and Inventory Tab Responsibilities

## Current State
- **Item Master tab** (`ItemMasterDefinitionTab`): Has "Add Item" and a view/edit button (Eye icon), but no dedicated Edit or Delete actions. Navigation-only actions (View in Inventory, View Bin Allocations, Stock Movement History).
- **Inventory tab** (`ItemMasterTab`): Has "Add Items", Edit, Delete, View, Transfer, Stock Adjustment -- full CRUD operations on items.

This violates the **industrial standard separation** where the Item Master is the single source of truth for item catalog management (CRUD), and the Inventory module focuses on stock operations only.

## Proposed Changes

### 1. Item Master Tab -- Full CRUD (Single Source of Truth)
Add proper **Edit** and **Delete** action buttons alongside existing navigation actions:
- **Edit** (Pencil icon): Opens the existing `AddItemsDialog` in edit mode
- **Delete** (Trash icon): Opens `DeleteItemConfirmationDialog` with mark-inactive option (admin/moderator only, per existing RBAC rules)
- Keep existing: Add Item button, View in Inventory, Bin Allocations, Stock Movement History

### 2. Inventory Tab -- Stock Operations Only
Remove item creation capability since that belongs in Item Master:
- **Remove** the "Add Items" button
- **Remove** the Edit button (item metadata changes go through Item Master)
- **Keep**: View Details, Stock Adjustment, Stock Movement History, Transfer, Delete (admin only), Admin Tools, Download/Export
- This ensures Inventory is purely for stock-level operations (adjustments, transfers, movements, audits)

### 3. Industrial Standard Alignment
This follows **ERP best practices** (SAP MM, Oracle Inventory):
- **Master Data Module** (Item Master): Owns item creation, metadata editing, and lifecycle management (active/inactive/discontinued)
- **Inventory Module**: Owns stock quantities, movements, adjustments, and warehouse operations
- Clear separation prevents accidental item duplication and ensures a single entry point for catalog management

## Files to Modify

| File | Change |
|------|--------|
| `src/components/warehouse/ItemMasterDefinitionTab.tsx` | Add Edit (pencil) and Delete action buttons, import `DeleteItemConfirmationDialog`, `useIsAdminOrHigher`, add delete state and handlers |
| `src/components/warehouse/ItemMasterTab.tsx` | Remove "Add Items" button and Edit button from actions column; keep stock-focused operations only |

## Technical Details

**ItemMasterDefinitionTab.tsx changes:**
- Import `Edit, Trash2` from lucide-react, `DeleteItemConfirmationDialog`, `useIsAdminOrHigher`
- Add `deletingItem` state and wire up `deleteItem`/`markItemInactive` from `useWarehouseItems`
- Add Edit and Delete buttons in the actions column (Edit opens AddItemsDialog via existing `setEditingItem`, Delete opens confirmation dialog)
- Delete button visibility gated by `canDelete` from `useIsAdminOrHigher` hook (consistent with existing RBAC pattern)

**ItemMasterTab.tsx changes:**
- Remove the "Add Items" `Button` (line 449-452)
- Remove the Edit `Button` from actions column (lines 685-692)
- Keep View, Transfer, Delete, Stock Adjustment, Stock Movement buttons

