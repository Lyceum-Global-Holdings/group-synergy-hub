---
name: unified-on-hand-tools-merge
description: Tools merge into Bin Allocations + Inventory via frontend hook; edits stay in Tool Management
type: architecture
---
Tools live in `warehouse_tools` with allocations in `tool_bin_allocations`,
separate from `warehouse_items` / `warehouse_bin_allocations`. To give one
canonical "what's physically in my warehouse" view:

- `useAllToolBinAllocations` fetches every tool allocation for the active
  company (joined with `warehouse_tools` + `warehouse_bins` + parent location)
  and returns rows shaped as `BinAllocationWithDetails` with an
  `_entity_type: 'tool'` discriminator.
- `BinAllocationsTab` concatenates these onto the item allocations, adds a
  Type column (Item / Tool badge), and disables Move / Delete / QR for tool
  rows (use Tool Management instead). Bulk QR print filters tools out.
- `/warehouse/inventory` exposes an Items / Tools tab pair; the Tools tab
  renders `ToolsInventoryOnHand` (read-only) linking back to Tool Management.
- All mutations in `useToolBinAllocations` invalidate `tool-bin-allocations`
  AND `tool-bin-allocations-all`. The shared
  `WAREHOUSE_STOCK_QUERY_KEYS` set in `useInvalidateWarehouseStock` now
  includes both tool keys + `warehouse-tools`, so any stock mutation refreshes
  both surfaces.

Never duplicate tool write logic into Bin Allocations / Inventory. Edits
stay in Tool Management; these surfaces are read-only for tools.
