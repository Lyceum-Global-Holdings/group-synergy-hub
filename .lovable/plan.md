

# Plan: Differentiate Bulk-Tracked vs Serial-Tracked Inventory Categories

## Overview

Currently, the construction inventory system treats Tools, Safety, Equipment, and Scaffolding similarly to Machines with individual serial tracking. This needs to change:

- **Machines**: Serial-tracked (each unit has a unique serial number and ID)
- **Tools, Safety, Equipment, Scaffolding**: Bulk/Quantity-tracked (one Item ID per item type, quantity field instead of serial numbers)

For example: 7 yellow safety helmets should have ONE Item ID with quantity=7, not 7 separate records.

---

## Current Architecture Summary

| Component | Current Behavior |
|-----------|-----------------|
| `construction_item_master` | Stores item types with `is_serial_tracked` flag |
| `construction_serial_numbers` | Stores individual machine serial numbers |
| `construction_inventory_stock` | Stores quantity-based stock at locations |
| `AddItemDialog` | Shows serial fields for machines only (correct) |
| `BulkImportDialog` | Shows serial fields for machines only (correct) |
| `ItemMasterView` | Shows "Serial Numbers" column only for machines (correct) |

The database architecture is already correct. The main changes needed are:

1. For bulk-tracked categories (tools, safety, equipment, scaffolding), add ability to set initial quantity and location when adding items
2. Update import templates to include quantity/location fields for bulk items
3. Add category-specific "Add Tool", "Add Safety", etc. buttons in Inventory-Wise view
4. Connect Item Master data to the Allocation Dashboard

---

## Changes Required

### 1. Modify AddItemDialog for Bulk Categories

**File: `src/components/construction/inventory/AddItemDialog.tsx`**

For non-machine categories (tools, safety, equipment, scaffolding), add:
- **Initial Quantity** field (number input)
- **Location** dropdown (where this initial stock will be stored)

When submitted:
1. Create the item in `construction_item_master` 
2. If quantity > 0 and location selected, create/update record in `construction_inventory_stock`
3. Log a transaction as `initial_stock`

### 2. Update BulkImportDialog for Bulk Categories

**File: `src/components/construction/inventory/BulkImportDialog.tsx`**

For non-machine categories, the import template should include:
- `item_code`, `item_name`, `section`, `brand`, `model`, `unit_of_measurement`, `description`, `unit_cost`
- `initial_quantity` (number of items)
- `location_name` (matching warehouse location name)

Update parsing logic to:
1. Create items in `construction_item_master` (without serial tracking)
2. Create stock records in `construction_inventory_stock` for items with quantity > 0
3. Match location_name to location_id via lookup

### 3. Add Category-Specific Buttons in InventoryWiseView

**File: `src/components/construction/inventory/InventoryWiseView.tsx`**

Replace single "Add Item" button with a dropdown menu containing:
- Add Machine (serial-tracked)
- Add Tool
- Add Safety Item
- Add Equipment
- Add Scaffolding

Each button opens `AddItemDialog` with the corresponding category pre-selected.

### 4. Update ItemMasterView Column Display

**File: `src/components/construction/inventory/ItemMasterView.tsx`**

For bulk categories (tools, safety, equipment, scaffolding):
- Replace "Serial Numbers" column with "Total Quantity" column
- Show aggregated quantity from `construction_inventory_stock` table
- Remove the "Serial" badge for these categories

### 5. Create useCreateItemMasterWithStock Hook

**File: `src/hooks/construction/useConstructionInventory.ts`**

Add new mutation that:
1. Creates item master record
2. Creates stock record at specified location if quantity > 0
3. Logs initial_stock transaction

### 6. Update AllocationDashboard Statistics

**File: `src/components/construction/inventory/AllocationDashboard.tsx`**

Ensure the dashboard reflects:
- Total quantity of bulk items by category
- Correct display of tools, safety, equipment, scaffolding quantities
- Connection to Item Master categories

---

## Technical Details

### Form Schema for Bulk Categories

```typescript
// Additional fields for bulk-tracked items
interface BulkItemFields {
  initial_quantity?: number;  // Starting quantity for this item type
  location_id?: string;       // Where to store initial stock
}
```

### Category Detection Logic

```typescript
const BULK_CATEGORIES: ItemCategory[] = ['tools', 'safety', 'equipment', 'scaffolding'];
const isBulkTracked = BULK_CATEGORIES.includes(category);
```

### Stock Creation Flow for Bulk Items

```text
User fills form with:
  - Item details (name, code, etc.)
  - Initial Quantity: 7
  - Location: "Main Warehouse"
       ↓
1. Insert into construction_item_master (is_serial_tracked = false)
2. Insert into construction_inventory_stock (item_master_id, location_id, quantity=7)
3. Insert into construction_inventory_transactions (type='initial_stock', quantity=7)
```

### Import Template for Bulk Categories

| item_code | item_name | section | brand | unit_of_measurement | unit_cost | initial_quantity | location_name |
|-----------|-----------|---------|-------|---------------------|-----------|------------------|---------------|
| SAF-001 | Safety Helmet - Yellow | civil | 3M | pcs | 250 | 7 | Main Warehouse |
| TOL-001 | Hammer - Steel | civil | Stanley | pcs | 500 | 15 | Site A Store |

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/construction/inventory/AddItemDialog.tsx` | Modify | Add quantity/location fields for bulk categories |
| `src/components/construction/inventory/BulkImportDialog.tsx` | Modify | Update template and parsing for bulk categories |
| `src/components/construction/inventory/InventoryWiseView.tsx` | Modify | Add category-specific add buttons |
| `src/components/construction/inventory/ItemMasterView.tsx` | Modify | Show quantity column for bulk categories |
| `src/hooks/construction/useConstructionInventory.ts` | Modify | Add mutation for creating items with initial stock |
| `src/components/construction/inventory/AllocationDashboard.tsx` | Modify | Ensure proper display of bulk item statistics |

---

## User Experience After Changes

### Adding a Bulk Item (e.g., Safety Helmets)
1. Go to Item Master > Safety tab
2. Click "Add Safety"
3. Fill in: Item Code (auto: SAF-001), Name: "Safety Helmet - Yellow", Section, etc.
4. Set Initial Quantity: 7
5. Select Location: "Main Warehouse"
6. Click Save
7. Result: One item record, with 7 units at Main Warehouse

### Importing Bulk Items
1. Go to Item Master > Tools tab
2. Click "Import Data" > Download Template
3. Template includes: item_code, item_name, ..., **initial_quantity**, **location_name**
4. Fill in data and upload
5. Items created with stock at specified locations

### Viewing in Inventory-Wise
1. Tools show as single card with "Stock by Location" section
2. Displays: "Main Warehouse: 7 pcs", "Site A: 3 pcs", etc.
3. No serial numbers shown (machines only have serial numbers)

