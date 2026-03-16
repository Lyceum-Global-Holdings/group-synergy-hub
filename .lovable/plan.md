

# Performance Fix: Remove Redundant Heavy Queries from Inventory Tab

## Problem

The Inventory tab (`ItemMasterTab.tsx`) is extremely slow because it fires several massive queries that are either redundant or not needed for the current view:

1. **`useStockAudit()` (line 163)** — Fetches ALL active warehouse items + ALL bin allocations in batched loops just to show a summary. This is only needed on the Stock Audit tab, not the Inventory tab.

2. **`useWarehouseBinAllocations()` (line 161)** — Fetches ALL bin allocations with full item/bin joins. This is only needed on the Bin Allocations tab. The Inventory tab only uses the mutation functions (`migrateAllocationsToCorrectLocation`, `reconcileStock`, `fixAllocationsFromHistory`).

3. **`all-items-location-stock` query (lines 214-319)** — Fetches ALL allocations across the entire database in 1000-row batches, then ALL bins, then ALL locations, just to show location breakdown per item. This runs on every page load even when not visible.

4. **Triple `useRealtimeStockUpdates()`** — Called in `ItemBinMaster.tsx`, `ItemMasterTab.tsx`, and `BinMasterTab.tsx`, creating 3 duplicate realtime subscriptions to the same channels.

## Fix Plan

### 1. Remove `useStockAudit()` from ItemMasterTab (biggest win)
**File: `src/components/warehouse/ItemMasterTab.tsx`**
- Remove `import { useStockAudit }` and the `const { summary } = useStockAudit()` call
- Find where `summary` is used in this component (likely a desync alert banner) and either remove it or replace with a lightweight count query

### 2. Split `useWarehouseBinAllocations` — mutations only
**File: `src/components/warehouse/ItemMasterTab.tsx`**
- The hook fetches ALL allocations but the Inventory tab only uses mutations. Change to pass a `disableFetch` option (or extract mutations into a separate hook) so the heavy fetch query is skipped.

### 3. Lazy-load `all-items-location-stock` query
**File: `src/components/warehouse/ItemMasterTab.tsx`**
- Add `enabled: false` or gate behind a user action (e.g., only fetch when a location column is visible or an item's location popover is opened)

### 4. Deduplicate realtime subscriptions
**Files: `src/components/warehouse/ItemMasterTab.tsx`, `src/components/warehouse/BinMasterTab.tsx`**
- Remove `useRealtimeStockUpdates()` from both child components — it's already called in the parent `ItemBinMaster.tsx`

### Files to modify

| File | Change |
|------|--------|
| `src/components/warehouse/ItemMasterTab.tsx` | Remove `useStockAudit`, disable fetch in `useWarehouseBinAllocations`, lazy-load location stock query, remove duplicate realtime hook |
| `src/components/warehouse/BinMasterTab.tsx` | Remove duplicate `useRealtimeStockUpdates()` |
| `src/hooks/useWarehouseBinAllocations.ts` | Add `disableFetch` option to skip the heavy query when only mutations are needed |

### Expected impact
- Eliminates 3-4 heavy batch-loop queries that each fetch thousands of rows on page load
- Removes 2 duplicate realtime channel subscriptions
- The Inventory tab should load in seconds instead of getting stuck

