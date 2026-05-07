---
name: warehouse-inventory-server-pagination
description: Inventory tab uses list_warehouse_inventory RPC + keyset cursor; never fetch all warehouse_items client-side
type: architecture
---
The Warehouse Inventory tab and any new inventory browsers MUST use `useWarehouseInventoryPage` (RPC `public.list_warehouse_inventory`, SECURITY INVOKER, page size 50, keyset cursor on `(created_at, id)`).

- Do NOT call `useWarehouseItems()` to render lists — that hook full-fetches all rows for selectors/bulk ops only and now uses `staleTime: 30s` (no more `staleTime: 0` + `refetchOnMount: 'always'`).
- Search, category, status, and location filters must be passed as RPC params — never filter 14k+ rows client-side.
- Tabs in `src/pages/warehouse/ItemBinMaster.tsx` are React.lazy + gated on `activeTab` so only the active tab mounts and fetches.
- Realtime stock changes invalidate `['warehouse-inventory-page', ...]` and `['warehouse-items', ...]` via the existing realtime bus.

Indexes backing the RPC: `warehouse_items(company_id, created_at DESC, id DESC)`, trigram on `name` and `item_code`, `warehouse_bin_allocations(warehouse_item_id)`.
