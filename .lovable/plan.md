

# Plan: Fix Stock Movement Report - Add Supplier and Item Movement History

## Issues Identified

1. **Missing Supplier Information**: The Stock Movement Report doesn't include supplier data, even though `warehouse_items` has a `supplier_id` field that references the `suppliers` table.

2. **Movement History Working But Missing Supplier**: The query is correctly fetching stock transactions, but the supplier relationship needs to be resolved through the item's `supplier_id`.

## Solution

Update the `useStockMovementReport` hook and `StockMovementReportDialog` component to include supplier information in the exported Excel file.

---

## Implementation Details

### 1. Update useStockMovementReport Hook

**File:** `src/hooks/useStockMovementReport.ts`

**Changes:**

1. Add `supplier_name` to the `StockMovementReportItem` interface
2. Update the warehouse_items query to also fetch supplier_id
3. Fetch suppliers data and create a lookup map
4. Map supplier name to each report item

**Updated Interface:**
```typescript
export interface StockMovementReportItem {
  // ... existing fields
  supplier_name: string | null;  // NEW FIELD
}
```

**Additional Query:**
- Fetch `supplier_id` from `warehouse_items`
- Fetch supplier names from `suppliers` table based on unique supplier IDs
- Create a suppliers lookup map

### 2. Update StockMovementReportDialog Component

**File:** `src/components/warehouse/StockMovementReportDialog.tsx`

**Changes:**

Add 'Supplier' column to the Excel export data mapping:

```typescript
const exportData = reportData.map((item: StockMovementReportItem) => ({
  // ... existing fields
  'Supplier': item.supplier_name || '',  // NEW COLUMN
  // ... rest of fields
}));
```

**Column Position:** Insert 'Supplier' after 'Brand' to match the Item Master Download format.

---

## Updated Excel Export Columns

The Stock Movement Report will now include:

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
| **Supplier** | **Item's default supplier (NEW)** |
| Qty Change | Quantity changed |
| Qty Before | Stock before transaction |
| Qty After | Stock after transaction |
| Unit Cost (LKR) | Cost per unit |
| Total Value (LKR) | Total transaction value |
| Issued To Location | Target location |
| Created By | User who created |
| Notes | Transaction notes |

---

## Technical Implementation

### Step 1: Modify useStockMovementReport.ts

```typescript
// In the warehouse_items query, add supplier_id
const { data: items, error: itemsError } = await supabase
  .from('warehouse_items')
  .select(`
    id,
    item_code,
    name,
    brand,
    category_id,
    supplier_id,  // ADD THIS
    item_categories (id, name)
  `)
  .in('id', itemIds);

// After fetching items, get unique supplier IDs
const supplierIds = [...new Set(
  items?.map(item => item.supplier_id).filter(Boolean)
)] as string[];

// Fetch suppliers
let suppliersMap = new Map<string, string>();
if (supplierIds.length > 0) {
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .in('id', supplierIds);
  
  if (suppliers) {
    suppliersMap = new Map(suppliers.map(s => [s.id, s.name]));
  }
}

// Update items map to include supplier_id
const itemsMap = new Map(
  items?.map(item => [item.id, {
    // ... existing fields
    supplier_id: item.supplier_id,
    supplier_name: item.supplier_id ? suppliersMap.get(item.supplier_id) || null : null
  }])
);
```

### Step 2: Modify StockMovementReportDialog.tsx

```typescript
// In the exportData mapping, add Supplier column after Brand
const exportData = reportData.map((item: StockMovementReportItem) => ({
  'Date/Time': format(new Date(item.created_at), 'yyyy-MM-dd HH:mm:ss'),
  'Transaction Type': formatTransactionType(item.transaction_type),
  'Reference Type': item.reference_type?.replace(/_/g, ' ').toUpperCase() || '',
  'Reference ID': item.reference_id || '',
  'Item Code': item.item_code,
  'Item Name': item.item_name,
  'Category': item.category_name || '',
  'Brand': item.brand || '',
  'Supplier': item.supplier_name || '',  // NEW
  'Qty Change': item.quantity_change,
  // ... rest unchanged
}));
```

---

## Files to Modify

1. `src/hooks/useStockMovementReport.ts` - Add supplier fetching and mapping
2. `src/components/warehouse/StockMovementReportDialog.tsx` - Add Supplier column to export

## No Database Changes Required

The `supplier_id` field already exists in `warehouse_items` and references the `suppliers` table correctly.

