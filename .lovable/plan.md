

# Fix: Bin Dropdown Empty in Bulk Stock Upload

## Problem
When selecting a location in the bulk stock upload dialog, the bin dropdown shows no bins — even though bins are linked to that location.

## Root Cause
The query in `BulkStockUploadDialog.tsx` (line 94) filters bins using `.eq('is_active', true)`, but the `warehouse_bins` table has no `is_active` column. It uses a `status` field (string, e.g. `'active'`). This causes the query to silently return zero results.

## Fix — `src/components/warehouse/BulkStockUploadDialog.tsx`

**Line 94**: Change `.eq('is_active', true)` to `.eq('status', 'active')`

This is a one-line fix. The rest of the bin-fetching logic (location filter, ordering) is correct.

