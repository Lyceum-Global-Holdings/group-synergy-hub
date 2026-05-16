---
name: Bulk catalog-to-inventory import
description: /warehouse/inventory "Bulk add from catalog" grid + bulk_provision_inventory_from_catalog RPC; provisions existing catalog items into warehouse_items per (company, location, bin) with opening stock.
type: feature
---

UI: `src/components/warehouse/bulk-catalog-import/BulkCatalogToInventoryDialog.tsx` — full-height Sheet with editable table. Picker per row uses `useWarehouseCatalogPage` (no catalog creation). Three input modes:
1. Per-row catalog picker.
2. Paste codes dialog (item_code / GTIN / SKU, one per line) — resolves via `warehouse_item_catalog`.
3. Direct TSV paste into the grid (first column = code) routes through the same resolver.

Rules:
- One row per (catalog_item_id, company_id, location_id, bin_id); duplicates flagged in-grid.
- `opening_qty > 0` requires `location_id`. `bin_id` requires `location_id`.
- Defaults company to `useCompany().selectedCompany`; bin list filtered by chosen location.

Backend RPC: `bulk_provision_inventory_from_catalog(p_rows jsonb)` (SECURITY DEFINER, search_path=public, GRANT to authenticated).
- Per row, in a savepoint: resolves catalog by id → item_code → barcode/sku; calls `upsert_warehouse_inventory` (catalog source of truth — never writes mirrored fields); if `opening_qty > 0`, inserts `stock_transactions` with `transaction_type='opening_stock'`, `adjustment_reason='opening_balance'`, `bin_id`. Existing triggers maintain bin allocations and ledger qty_before/after.
- Returns `[{row, status: 'imported'|'provisioned'|'error', catalog_item_id, warehouse_item_id, error}]`. Batch never fully aborts.

This flow does NOT create catalog items — use existing Add Item / Bulk Item Import for that.
