

# Bulk Stock Upload via CSV (per Company + Location)

## What it does

A new dialog that lets users upload a CSV file to set/update stock levels for **existing inventory items**. The user selects a company and location, then uploads a CSV with columns: `item_code`, `quantity`, `bin_code`. The system matches each row's `item_code` against `warehouse_items` for that company, finds or creates the bin allocation, and updates stock accordingly.

This is different from the existing bulk item import (which creates new catalog/inventory items). This feature only touches stock quantities and bin allocations for items already in the inventory.

## CSV Template

```
item_code,quantity,bin_code
ITEM001,50,BIN-A1
ITEM002,100,BIN-B2
```

## User Flow

1. User opens the dialog from the Inventory tab toolbar (new "Upload Stock" button)
2. User selects target **company** and **location** (pre-filled from current selection)
3. User downloads CSV template or uploads their CSV
4. System parses and validates:
   - `item_code` matched against `warehouse_items` for the selected company
   - `bin_code` matched against `warehouse_bins` for the selected location
   - Quantity must be a positive number
5. Preview table shows: item_code, name (resolved), quantity, bin, status (matched/not found/error)
6. User confirms → system processes each row:
   - **Upsert bin allocation**: If allocation exists for (item_id, bin_id), update `allocated_quantity`; if not, insert new allocation
   - **Create stock transaction**: Insert `stock_transactions` record with type `opening_stock`
   - Stock sync triggers handle `current_stock` on `warehouse_items`

## Files to create/modify

| File | Change |
|------|--------|
| `src/components/warehouse/BulkStockUploadDialog.tsx` | **New** — Full dialog component with CSV parsing, validation, preview, and import logic |
| `src/components/warehouse/ItemMasterTab.tsx` | Add "Upload Stock" button to the toolbar dropdown menu |

## Technical Details

- **Matching**: Items matched via `item_code` (case-insensitive) filtered by `company_id`. Bins matched via `bin_code` (case-insensitive) filtered by `location_id`.
- **Upsert logic**: For each CSV row, check if `warehouse_bin_allocations` row exists for `(warehouse_item_id, bin_id)`. If yes, update `allocated_quantity += csv_quantity`. If no, insert new allocation.
- **Stock transaction**: Each row creates a `stock_transactions` record (`opening_stock` type) for audit trail.
- **No new DB migrations needed** — uses existing tables and patterns.
- Reuses the CSV parser pattern from `BulkItemImportContent.tsx`.
- Company and location selectors use existing `useCompany` and `useWarehouseLocations` hooks.

