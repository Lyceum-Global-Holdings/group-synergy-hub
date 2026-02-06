

# Plan: Track Sub-Location Stock Changes in Stock Movement Report

## Overview
Enhance the Stock Movement Report to track stock changes by sub-location. This includes adding the item's default location and resolving from/to location details for transfer transactions.

## Current State
- The report currently captures `issued_to_location_id` from `stock_transactions` for material issues to sub-locations
- Transfer transactions (`transfer_in`, `transfer_out`) have a `reference_id` pointing to `stock_transfer_requests`, but the from/to location info is not being resolved
- The item's default warehouse location (`warehouse_items.location_id`) is not included

## Solution

Add comprehensive location tracking to the Stock Movement Report:

1. **Item Location** - The item's default/primary warehouse location from `warehouse_items.location_id`
2. **From Location** - For transfers, resolved from `stock_transfer_requests` (from_location + from_sublocation)
3. **To Location** - For transfers, resolved from `stock_transfer_requests` (to_location + to_sublocation)
4. **Keep existing** - "Issued To Location" for material issues to sub-locations

---

## Implementation Details

### 1. Update StockMovementReportItem Interface

**File:** `src/hooks/useStockMovementReport.ts`

Add new fields to the interface:
- `item_location_name: string | null` - Item's default warehouse location
- `from_location_name: string | null` - Transfer source location (location + sublocation combined)
- `to_location_name: string | null` - Transfer destination location (location + sublocation combined)

### 2. Update Data Fetching Logic

**File:** `src/hooks/useStockMovementReport.ts`

Changes:
1. Fetch `location_id` from `warehouse_items` query
2. Build lookup map for item locations
3. Identify transfer transactions (where `reference_type = 'transfer'`)
4. Fetch related `stock_transfer_requests` records for transfer reference IDs
5. Resolve from/to location names including sublocations
6. Map the location data to report items

**Query Updates:**

```typescript
// 1. Add location_id to warehouse_items query
.select(`
  id,
  item_code,
  name,
  brand,
  category_id,
  supplier_id,
  location_id,  // ADD THIS
  item_categories (id, name)
`)

// 2. Create item location lookup from the locations already being fetched

// 3. For transfer transactions, fetch stock_transfer_requests
const transferReferenceIds = filteredTransactions
  .filter(t => t.reference_type === 'transfer' && t.reference_id)
  .map(t => t.reference_id);

if (transferReferenceIds.length > 0) {
  const { data: transfers } = await supabase
    .from('stock_transfer_requests')
    .select(`
      id,
      from_location:warehouse_locations!stock_transfer_requests_from_location_id_fkey(name),
      from_sublocation:warehouse_locations!stock_transfer_requests_from_sublocation_id_fkey(name),
      to_location:warehouse_locations!stock_transfer_requests_to_location_id_fkey(name),
      to_sublocation:warehouse_locations!stock_transfer_requests_to_sublocation_id_fkey(name)
    `)
    .in('id', transferReferenceIds);
}
```

### 3. Update Excel Export Columns

**File:** `src/components/warehouse/StockMovementReportDialog.tsx`

Add new columns to the export mapping after "Supplier":
- `'Item Location'` - Item's default warehouse location
- `'From Location'` - Source location for transfers (shows "Location > Sublocation" format)
- `'To Location'` - Destination location for transfers

### 4. Updated Excel Column Order

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
| **Item Location** | **Item's default warehouse location (NEW)** |
| **From Location** | **Transfer source location + sublocation (NEW)** |
| **To Location** | **Transfer destination location + sublocation (NEW)** |
| Qty Change | Quantity changed |
| Qty Before | Stock before transaction |
| Qty After | Stock after transaction |
| Unit Cost (LKR) | Cost per unit |
| Total Value (LKR) | Total transaction value |
| Issued To Location | Target location for material issues |
| Created By | User who created |
| Notes | Transaction notes |

---

## Data Flow

```text
fetchReport() called with date filters
            |
            v
Query stock_transactions for date range
            |
            v
Extract unique item_ids and reference_ids
            |
            v
┌─────────────────────────────────────────┐
│ Parallel fetches:                       │
│ - warehouse_items (with location_id)    │
│ - suppliers                             │
│ - profiles_directory                    │
│ - warehouse_locations                   │
│ - stock_transfer_requests (for transfers)│
└─────────────────────────────────────────┘
            |
            v
Build lookup maps for all related data
            |
            v
Map transactions to report items with:
 - item_location_name (from item's location_id)
 - from_location_name (from transfer request, if applicable)
 - to_location_name (from transfer request, if applicable)
 - issued_to_location_name (existing)
            |
            v
Return enriched report data
```

---

## Files to Modify

1. `src/hooks/useStockMovementReport.ts` - Add location fetching and mapping logic
2. `src/components/warehouse/StockMovementReportDialog.tsx` - Add new columns to Excel export

## Technical Notes

- Location names will be combined as "Location > Sublocation" when both exist
- For non-transfer transactions, from/to location fields will be empty
- The item's default location comes from `warehouse_items.location_id`
- Transfer locations come from the referenced `stock_transfer_requests` record
- Existing "Issued To Location" remains for material issue transactions

## Example Output

For a transfer transaction:
| Item Location | From Location | To Location | Issued To Location |
|--------------|---------------|-------------|--------------------|
| Main Warehouse | Main Warehouse > Zone A | Branch Office > Storage B | |

For a material issue to sub-location:
| Item Location | From Location | To Location | Issued To Location |
|--------------|---------------|-------------|--------------------|
| Main Warehouse | | | Site A - Construction |

For an adjustment:
| Item Location | From Location | To Location | Issued To Location |
|--------------|---------------|-------------|--------------------|
| Main Warehouse | | | |

