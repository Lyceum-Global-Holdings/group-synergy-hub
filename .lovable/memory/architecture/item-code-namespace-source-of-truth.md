---
name: item-code-namespace-source-of-truth
description: Next-item-code generators must scan warehouse_item_catalog (global UNIQUE owner), never warehouse_items (per-company); use next_catalog_item_code RPC for collision-free allocation
type: preference
---
Next-warehouse-item-code generation MUST query `warehouse_item_catalog` (the GLOBAL table that owns the `UNIQUE(item_code)` constraint), NEVER `warehouse_items` (the per-company inventory layer).

**Why:** `SingleItemForm` and any future "Create Item" flow does a dual insert (catalog first, inventory second). The catalog row's `item_code` is the one that has to satisfy the global UNIQUE — generating a sequence by scanning the per-company inventory misses every code allocated by *any other* company and produces guaranteed collisions (`warehouse_item_catalog_item_code_key`). Aligns with GS1 GTIN-13 / ISO/IEC 15459 (globally unique identifiers) and SAP MM Material Number (unique within client).

**How to apply:**
- Server-of-record: call `next_catalog_item_code(p_category_code text)` — SECURITY INVOKER, STABLE, returns `'INV-{CAT}-{NNN}'` with format-tolerant parsing of leading digits (`001` and `0001` are both numeric `1`).
- Client hook `useNextWarehouseItemCode` calls the RPC first; falls back to a client-side scan of `warehouse_item_catalog` only if the RPC errors.
- Shared util `allocateItemCodes` (used by bulk import) also queries the catalog regardless of `scope: 'inventory' | 'catalog'`.
- `useWarehouseItemCatalog.createMutation` accepts `_autoCodeCategory`; on `warehouse_item_catalog_item_code_key` collision it re-fetches via the RPC and retries the insert ONCE before surfacing the error toast — this self-heals races between two simultaneous "Add Item" submissions.
- Dual-insert flows MUST forward the catalog row's returned `item_code` to the inventory insert (Phase 9.5: `createData.item_code = catalogResult.item_code`); otherwise a retry-allocated code in the catalog won't match the user's stale form value in `warehouse_items`.
- 3-digit zero-pad is preserved up to 999 to keep typical codes (`INV-XXX-NNN` = 11 chars) inside the 13-char GS1 budget; codes naturally widen past 999 without a width cap.
