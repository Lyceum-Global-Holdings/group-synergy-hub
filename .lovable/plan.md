## Phase 9.1 — Fix Tool Import statement timeout

### Root cause

The dialog now correctly reads from the catalog, but `get_tool_catalog_candidates` is timing out (>8s, Postgres aborts with `canceling statement due to statement timeout`).

Two reasons, both confirmed against the live DB:

1. **No index on `warehouse_items.catalog_item_id`.** Verified via `pg_indexes` — zero indexes referencing that column. The RPC's `LEFT JOIN LATERAL (SELECT … FROM warehouse_items WHERE catalog_item_id = c.id …)` therefore runs a sequential scan on the 14,777-row inventory table **once per catalog row** (14,911 outer rows × 14,777 inner rows ≈ 220 M comparisons). That alone exceeds the 8 s statement timeout.

2. **LATERAL with `ORDER BY updated_at DESC LIMIT 1` is a per-row sort.** Even with the index, sorting per-outer-row by `updated_at` is wasteful when 99 % of catalog rows have exactly one matching inventory row. We can collapse to a deterministic single-row pick without the per-row sort.

The Item Master tab works fine because it doesn't join `warehouse_items` at all.

### Outcome

- Dialog loads the full 14,911-row "All item master" scope in <1.5 s on a cold cache (target: <500 ms warm).
- `Suggested tools` and `Tool categories` scopes load in <300 ms.
- No more `statement timeout` errors.
- Inventory snapshot column (Stock @ target) still populated where data exists; never filters visibility.
- RLS, provenance, duplicate prevention from Phase 9 unchanged.

### Standards applied

- **PostgreSQL**: every FK column used in a JOIN must have a btree index — even when nullable. Composite `(catalog_item_id, company_id, location_id)` covers the lateral predicate as an index-only scan.
- **Query shape**: replace per-row `LATERAL … ORDER BY … LIMIT 1` with a `DISTINCT ON (catalog_item_id) …` CTE pre-aggregated once. One sort over 14k rows instead of 14k sorts of 1–2 rows each.
- **Project memory `list-rpc-pattern`**: hot picker queries return flat denormalized rows from a single round-trip; no PostgREST embed expansion.
- **Defence in depth**: keep the existing `idx_warehouse_item_catalog_status_name` index used by the outer scan.

### Changes

#### A) New migration

```sql
-- 1. The missing index — single biggest win
CREATE INDEX IF NOT EXISTS idx_warehouse_items_catalog_company
  ON public.warehouse_items (catalog_item_id, company_id, location_id)
  WHERE catalog_item_id IS NOT NULL;

-- 2. Rewrite the RPC to pre-aggregate the inventory snapshot once
CREATE OR REPLACE FUNCTION public.get_tool_catalog_candidates(
  p_search                 text     DEFAULT NULL,
  p_category_ids           uuid[]   DEFAULT NULL,
  p_include_all_categories boolean  DEFAULT false,
  p_target_company_id      uuid     DEFAULT NULL,
  p_target_location_id     uuid     DEFAULT NULL,
  p_limit                  int      DEFAULT 20000
)
RETURNS TABLE (...same shape as today...)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH inv AS (
    SELECT DISTINCT ON (i.catalog_item_id)
           i.catalog_item_id,
           i.id            AS inventory_item_id,
           i.current_stock,
           i.location_id   AS inventory_location_id
    FROM public.warehouse_items i
    WHERE i.catalog_item_id IS NOT NULL
      AND (p_target_company_id  IS NULL OR i.company_id  = p_target_company_id)
      AND (p_target_location_id IS NULL OR i.location_id = p_target_location_id)
    ORDER BY i.catalog_item_id, i.updated_at DESC NULLS LAST
  )
  SELECT
    c.id, c.item_code, c.name, c.description,
    c.category_id, c.unit_id, c.unit_cost, c.image_url, c.status,
    cat.name AS category_name, cat.code AS category_code,
    u.abbreviation AS unit_abbreviation,
    inv.inventory_item_id, inv.current_stock, inv.inventory_location_id
  FROM public.warehouse_item_catalog c
  LEFT JOIN public.item_categories cat ON cat.id = c.category_id
  LEFT JOIN public.item_units      u   ON u.id   = c.unit_id
  LEFT JOIN inv                       ON inv.catalog_item_id = c.id
  WHERE c.status = 'active'
    AND (p_include_all_categories
         OR p_category_ids IS NULL
         OR c.category_id = ANY(p_category_ids))
    AND (p_search IS NULL OR p_search = ''
         OR c.name      ILIKE '%' || p_search || '%'
         OR c.item_code ILIKE '%' || p_search || '%'
         OR COALESCE(c.brand,'')   ILIKE '%' || p_search || '%'
         OR COALESCE(c.barcode,'') ILIKE '%' || p_search || '%'
         OR COALESCE(c.sku,'')     ILIKE '%' || p_search || '%')
  ORDER BY c.name ASC, c.item_code ASC
  LIMIT COALESCE(p_limit, 20000);
$$;
```

The CTE produces at most ~14,775 rows (one per linked inventory item) with one indexed scan + one sort. The outer query then does a single hash join on the indexed `catalog_item_id`.

#### B) Frontend — no functional change required

`ImportFromItemMasterDialog.tsx` already handles the response shape; no edits needed. The error will simply stop occurring.

Optional polish (small, same file): drop `p_target_location_id` from the React Query key when scope is `all` — the location only affects the snapshot column and shouldn't trigger refetches when toggled. Keep it for now; the new query is fast enough that this is unnecessary.

#### C) Memory

Add one bullet to `mem://architecture/list-rpc-pattern.md`: "Lateral joins inside list RPCs must be backed by a btree index on the join key. For 'snapshot' joins where ≥99 % of outer rows match 0–1 inner rows, prefer `DISTINCT ON` CTE over `LATERAL … LIMIT 1` to avoid per-row sorts."

### Files

**New migration**
- `supabase/migrations/<ts>_phase9_1_tool_candidates_perf_fix.sql` — index + rewritten RPC.

**Modified**
- `.lovable/memory/architecture/list-rpc-pattern.md` — one new bullet.

**Unchanged**
- `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx` — response shape identical.

### Out of scope

- Server-side pagination in the candidate RPC (not needed at 14k rows once indexed).
- Server-side search push-down via trigram (already indexed in Phase 9; trigger only kicks in once we pass `p_search` from the client — currently search is client-side and that's fine at this size).

### Verification

1. Reopen Tool Management → Import from Item Master with default scope. Dialog interactive in <1 s; "All item master" loads in <2 s.
2. `EXPLAIN ANALYZE SELECT * FROM get_tool_catalog_candidates(NULL, NULL, true, '<company>'::uuid, NULL, 20000)` shows: Bitmap/Index Scan on `idx_warehouse_items_catalog_company` for the CTE, Hash Left Join for the outer; total <300 ms.
3. Switch the destination location selector — list does not collapse; only the "Stock @ target" column changes.
4. Switch target company — counts update; no timeout.
5. Already-imported items stay hidden (`catalog_item_id` dedup intact).
6. `supabase--linter` reports no new warnings.
7. Existing realtime invalidation still refreshes the dialog within 1 s of a catalog INSERT.
