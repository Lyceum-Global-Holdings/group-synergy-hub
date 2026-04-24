

## Phase 8 — Item Master: fix broken pagination so all 14,891 items are reachable

### The actual bug

The Item Master tab claims to use cursor pagination but it is silently dropping ~14k rows. Two compounding defects in `src/hooks/useWarehouseItemsPaged.ts`:

1. **Tiebreaker collapse on bulk-imported rows.** 13,899 of 14,911 rows share *one* `created_at` (`2026-03-15 18:20:24.689807+00` — the original bulk import). The keyset cursor is `(created_at DESC, id DESC)`, but `id` is a random UUID v4. After page 1 loads 100 rows from inside that bucket, page 2 asks for `id < <random uuid>` which on random UUIDs only excludes roughly half the remaining bucket per fetch — so the iterator skips items unpredictably and terminates early when a page returns fewer than `pageSize` rows.
2. **`.or()` chaining bug.** Lines 78–79 call `query.or(searchOr)` and then `query.or(cursorOr)` on the same builder. PostgREST does **not** AND two consecutive `.or()` calls; the second replaces/merges into one OR group. The cursor predicate ends up OR'd with the search predicate, so rows outside the cursor window leak in (and worse, the cursor stops gating progress).

The same `fetchAllWarehouseItemsBatched` used by the Excel export has both defects, so the export is also incomplete.

The user-visible symptom: count badge shows ~14,891 but the infinite-scroll list stops well short, and clicking "Download Excel" gets a partial file.

### Outcome

- All 14,911 catalog rows reachable via infinite scroll, in a single deterministic order.
- Excel export contains every row matching the active filter (verified count = badge count).
- Page-2+ requests use a stable, monotonic cursor that survives the 13,899-row bulk-import bucket.
- Search + filter combinations still work; results stay correctly scoped (no leakage from broken `.or()` chaining).
- Same RPC pattern used by Tools (Phase 6) and Approvals (Phase 4), per `mem://architecture/list-rpc-pattern`.

### Standards applied

- **PostgreSQL keyset pagination (RFC-style):** the cursor must be a strictly monotonic tuple. We switch from `(created_at, id)` to `(created_at, item_code, id)` — `item_code` is unique per `(company_id, item_code)` and lexically stable, so pagination is deterministic even when 14k rows share `created_at`. `id` remains as a final tiebreaker for cross-company duplicates of `item_code`.
- **`SECURITY INVOKER` RPC** returning denormalized rows — one round trip, server-side `LEFT JOIN suppliers`, RLS preserved (project memory `list-rpc-pattern`).
- **Composite index** `(status, created_at DESC, item_code DESC, id DESC)` partial on `status='active'` — covers the default filter (the hot path) without bloating writes.
- **PostgREST `.or()` correctness:** never chain two `.or()` calls; combine into one expression server-side via the RPC, eliminating the class of bug entirely.

### Changes

#### A) New RPC `get_warehouse_catalog_page` (migration)

`SECURITY INVOKER`, signature:

```sql
get_warehouse_catalog_page(
  p_search          text     DEFAULT NULL,
  p_category_id     uuid     DEFAULT NULL,
  p_status          text     DEFAULT NULL,    -- NULL = all
  p_supplier_id     uuid     DEFAULT NULL,
  p_cursor_created  timestamptz DEFAULT NULL,
  p_cursor_code     text     DEFAULT NULL,
  p_cursor_id       uuid     DEFAULT NULL,
  p_limit           int      DEFAULT 100
) RETURNS TABLE (
  id uuid, item_code text, name text, description text,
  category_id uuid, unit_id uuid,
  brand text, barcode text, sku text,
  unit_cost numeric, selling_price numeric, reorder_level numeric,
  status text, image_url text,
  supplier_id uuid, supplier_name text,
  created_at timestamptz
)
```

Body uses one `SELECT … FROM warehouse_item_catalog c LEFT JOIN suppliers s ON s.id = c.supplier_id WHERE …` with the keyset predicate:

```sql
AND (
  p_cursor_created IS NULL
  OR c.created_at < p_cursor_created
  OR (c.created_at = p_cursor_created AND c.item_code < p_cursor_code)
  OR (c.created_at = p_cursor_created AND c.item_code = p_cursor_code AND c.id < p_cursor_id)
)
ORDER BY c.created_at DESC, c.item_code DESC, c.id DESC
LIMIT p_limit;
```

Search predicate is a single `(c.name ILIKE p OR c.item_code ILIKE p OR c.brand ILIKE p OR c.barcode ILIKE p OR c.sku ILIKE p)` — one expression, no `.or()` chaining bug possible.

Plus an exact-count companion RPC `get_warehouse_catalog_count(p_search, p_category_id, p_status, p_supplier_id)` returning `bigint` for the badge.

#### B) Composite indexes (same migration)

```sql
CREATE INDEX IF NOT EXISTS idx_warehouse_catalog_keyset
  ON public.warehouse_item_catalog (created_at DESC, item_code DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_warehouse_catalog_status_keyset
  ON public.warehouse_item_catalog (status, created_at DESC, item_code DESC, id DESC);

-- Trigram for search; reuse Phase 7 extension
CREATE INDEX IF NOT EXISTS idx_warehouse_catalog_name_trgm
  ON public.warehouse_item_catalog USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_warehouse_catalog_code_trgm
  ON public.warehouse_item_catalog USING gin (lower(item_code) gin_trgm_ops);
```

#### C) Rewrite `useWarehouseItemsPaged.ts`

- Replace the `.from('warehouse_item_catalog').select(...)` + chained `.or()` calls with a single `supabase.rpc('get_warehouse_catalog_page', { ... })`.
- Cursor type becomes `{ created_at: string; item_code: string; id: string }`.
- `useWarehouseItemsCount` → `supabase.rpc('get_warehouse_catalog_count', ...)`.
- `fetchAllWarehouseItemsBatched` → loops the same RPC with the new cursor shape; guaranteed to terminate when `< pageSize` rows return *and* every iteration advances the keyset.
- Map the flat RPC row back to `CatalogItem` (`{ ..., supplier: { id, name } }`) so consumer types stay stable (per `mem://architecture/list-rpc-pattern`).

#### D) Defensive client-side de-dup stays

The `seen` Set in `ItemMasterDefinitionTab.tsx` (lines 147–157) and in `fetchAllWarehouseItemsBatched` is kept as a belt-and-braces guard during rollout — it should never trigger after the fix, but if it does we'll see it in the row count.

#### E) Memory

- New: `mem://architecture/keyset-pagination-uniqueness` — "Keyset cursors must include a strictly unique tuple. For tables with bulk-imported rows sharing `created_at`, append `item_code` (or another business-unique column) before `id`. Random UUID `id` alone cannot tiebreak large equal-`created_at` buckets."
- Update `mem://architecture/list-rpc-pattern.md` with one bullet: "Search predicates inside list RPCs must be a single combined expression — never two PostgREST `.or()` calls (they merge into one OR group, not AND)."

### Files

**New migration**
- `supabase/migrations/<ts>_phase8_catalog_keyset_rpc.sql` — RPCs + indexes.

**Modified**
- `src/hooks/useWarehouseItemsPaged.ts` — RPC swap, new cursor tuple, count RPC, batched export uses RPC.
- `src/integrations/supabase/types.ts` — auto-regenerated.

**Unchanged but verified**
- `src/components/warehouse/ItemMasterDefinitionTab.tsx` — already de-dups by `id`; consumes the same `CatalogItem` shape; no edits needed.
- `src/components/warehouse/ItemMasterTab.tsx` (Inventory tab) — uses different hooks (`warehouse_items` not `warehouse_item_catalog`); out of scope.

### Out of scope

- Backfilling distinct `created_at` values on the 13,899 bulk-imported rows (would silently fix pagination but mask the design defect; the new cursor tuple is the correct fix).
- Migrating the Inventory tab (`useWarehouseItems`) — different table, no reported issue, addressed in Phase 4.
- Server-side fuzzy ranking — current ILIKE + trigram index is sub-100 ms at 14k rows.

### Verification

1. Open Item Master with no filters → scroll to the bottom. Loaded count in the table === badge count (14,911). Network tab shows N requests of `rpc/get_warehouse_catalog_page`, last one returns `< 100` rows.
2. `EXPLAIN ANALYZE` of `get_warehouse_catalog_page(NULL, NULL, NULL, NULL, NULL, NULL, NULL, 100)` shows index scan on `idx_warehouse_catalog_keyset`, execution <80 ms.
3. Apply `status=active` filter → badge `14,904`; scroll to bottom loads exactly 14,904 rows.
4. Search "drill" → results match a direct `SELECT COUNT(*) … WHERE name ILIKE '%drill%' OR …` against the table; cursor advances correctly across the 13,899-row bucket.
5. Click "Download Excel" with no filters → file contains 14,911 rows (was previously truncating to ~5k–8k).
6. RLS preserved: a non-admin user with access to only one company sees only that company's items in both list and export.
7. `supabase--linter` reports no new warnings on the migration.
8. No console errors; existing realtime invalidation (`useWarehouseItemCatalog`) still refreshes the list within 1 s of an INSERT.

