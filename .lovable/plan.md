

## Plan: Add "Download Excel" Button to Item Master

### What
Add a button next to "Add Item" that exports the currently filtered Item Master data to an Excel (.xlsx) file using the already-installed `exceljs` package.

### Changes

**`src/components/warehouse/ItemMasterDefinitionTab.tsx`**
1. Import `Download` icon from lucide-react and `exceljs`
2. Add a `handleDownloadExcel` function that:
   - Creates a workbook with one sheet "Item Master"
   - Adds columns: Item Code, Name, Category, Unit, Brand, Supplier, Barcode, SKU, Unit Cost, Selling Price, Reorder Level, Current Stock, Status
   - Populates rows from `filteredItems` (respects current filters)
   - Downloads as `Item_Master_YYYY-MM-DD.xlsx`
3. Add a "Download Excel" button next to the "Add Item" button

No database or backend changes needed — purely a client-side export using the existing `exceljs` dependency.

