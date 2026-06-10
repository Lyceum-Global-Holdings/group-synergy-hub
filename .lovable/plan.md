# Fix slow / frozen Item picker in Create Material Request

## Root cause

`ItemSelector` (`src/components/common/ItemSelector.tsx`) — used by the **Items** step of Create Material Request and 11 other dialogs — calls `useWarehouseItems()`, which **full-fetches every row** in `warehouse_items` (14k+ rows) and then renders **all of them** inside a shadcn `Command` list. That causes:

1. A multi-second blocking fetch when the dialog opens.
2. A massive synchronous render of thousands of `<CommandItem>` nodes, which jank-freezes the dialog.

This violates the existing memory rule `warehouse-inventory-server-pagination`: "Do NOT call `useWarehouseItems()` to render lists".

## Fix — server-side search picker

Rebuild `ItemSelector` to use the existing `list_warehouse_inventory` RPC (already used by the Inventory tab) with **debounced, server-side search** instead of full-fetch + client-side filter. The component's public API (`value`, `onSelect`, `placeholder`, `locationId`, `disabled`) stays identical so all 12 call sites keep working with zero changes.

### Behaviour

- Open → fetch first **50 rows** (active items, optionally scoped to `locationId`) via `list_warehouse_inventory`.
- Typing in the search box → debounce **250 ms** → re-query the RPC with `_search` so Postgres' trigram indexes do the work (instant, regardless of catalog size).
- Render only the returned rows (≤50). No virtualization needed at that size, so no jank.
- Loading state shown in `CommandEmpty` while the query is in flight; "Type to search…" hint when input is empty and results are truncated.
- Keep the existing selected-item display (badge + name) by caching the last selected `WarehouseItem` in local state so the trigger label still works even if the row isn't in the current page.
- `locationId` filter is passed straight through as `_location_ids: [locationId]` to the RPC, removing the separate `warehouse_bin_allocations` round-trip and the in-memory filter.

### Files

- `src/components/common/ItemSelector.tsx` — rewrite internals: drop `useWarehouseItems`, drop the `locationStock` effect, add a debounced `useQuery` keyed on `['item-selector', companyId, search, locationId]` calling `supabase.rpc('list_warehouse_inventory', …)` with `_limit: 50`, `_status: 'active'`, `_stock_mode: locationId ? 'in_stock' : 'all'`.
- No call-site changes required; behaviour for the 12 dialogs (Material Request/Issue/Return, Stock Transfer, Bulk Adjustment, PR/PO/BOM/Blanket PO, Supplier Items, Room Materials) is preserved.

## Out of scope

- No DB migration (RPC + indexes already exist).
- No changes to selection callback shape — `onSelect(item: WarehouseItem | null)` is unchanged.
- No edits to the surrounding Material Request flow / wizard.
