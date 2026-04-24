

## Phase 4 — Database performance: indexes + materialized RPCs

Phases 1–3 optimized the **client** (caching, bundle, realtime, virtualization). The remaining bottleneck is the **database**: large list endpoints (`warehouse_items`, `warehouse_tools`, `warehouse_assets`, approvals, KPIs) still do sequential scans + N+1 joins on every fetch. Phase 4 adds the missing composite indexes and replaces the heaviest list queries with single materialized RPCs.

### Outcome

- p95 query latency on hot list endpoints drops from ~800–1500 ms → <150 ms.
- KPI/dashboard queries return in <300 ms even at 14k+ rows.
- Approval Console initial load drops from ~2 s → <500 ms.
- Realtime invalidations refetch faster (smaller, indexed queries), so the UI feels snappier end-to-end.

### Standards applied

- **PostgreSQL best practice**: composite indexes on `(company_id, <sort_col>)` for every multi-tenant list query — covers RLS filter + ORDER BY in one index scan.
- **PostgREST/Supabase**: replace nested `select(...)` joins with single `rpc()` calls returning denormalized rows — eliminates N+1 round-trips and lets PG optimize the join plan.
- **Index hygiene**: partial indexes for "active/pending" filters where ≥80% of rows are excluded (e.g., approval queues).
- **Security**: all new RPCs are `SECURITY INVOKER` so existing RLS policies remain authoritative — no privilege escalation.

### Changes

#### A) Composite indexes — new migration

Add `(company_id, created_at DESC)` and `(company_id, updated_at DESC)` indexes to the hot list tables. Also add foreign-key indexes that are currently missing (Supabase linter flags these).

```sql
-- Hot list tables: company_id + sort column
CREATE INDEX IF NOT EXISTS idx_warehouse_items_company_created
  ON public.warehouse_items (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_tools_company_created
  ON public.warehouse_tools (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_assets_company_created
  ON public.warehouse_assets (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_bin_allocations_company_item
  ON public.warehouse_bin_allocations (company_id, item_id);

-- Approval queues: partial index on pending statuses only
CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_pending
  ON public.purchase_requisitions (company_id, created_at DESC)
  WHERE status IN ('submitted', 'pending_approval');

-- Foreign-key indexes (linter-flagged)
CREATE INDEX IF NOT EXISTS idx_warehouse_tools_category_id
  ON public.warehouse_tools (category_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_tools_location_id
  ON public.warehouse_tools (location_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_tools_unit_id
  ON public.warehouse_tools (unit_id);
CREATE INDEX IF NOT EXISTS idx_tool_issues_tool_id
  ON public.tool_issues (tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_issues_company_status
  ON public.tool_issues (company_id, status);
```

I'll run `supabase--linter` first to confirm the exact list of missing FK indexes and add any extras it surfaces.

#### B) Materialized list RPCs — replace N+1 selects

The current pattern in `useWarehouseTools` / `useWarehouseItems` does a multi-table join via PostgREST embedding (`select('*, category(*), location(*), unit(*)')`). At scale this triggers N+1 planning on the PG side. Replace with single RPCs that do the join server-side and return a flat row.

**New RPCs (`SECURITY INVOKER`):**

- `get_warehouse_tools_list(p_company_id uuid, p_search text default null, p_limit int default 5000)` — returns `id, tool_code, name, total_quantity, available_quantity, issued_quantity, condition, image_url, category_id, category_name, location_id, location_name, unit_id, unit_name, unit_abbr, created_at, updated_at`. RLS still applies because invoker context is preserved.
- `get_warehouse_items_list(p_company_id uuid, p_search text default null, p_limit int default 5000)` — similar shape.
- `get_warehouse_assets_list(p_company_id uuid, p_limit int default 5000)` — similar.

Each RPC is a single `SELECT … LEFT JOIN …` with the new composite index used on `(company_id, created_at DESC)`. One round-trip instead of one+joined-embeds.

#### C) Wire RPCs into hot hooks

- `src/hooks/useWarehouseTools.ts` — swap the `from('warehouse_tools').select(...)` to `rpc('get_warehouse_tools_list', { p_company_id })`. Map flat rows to the existing `WarehouseTool` shape (so consumers don't change). Realtime bus subscription unchanged.
- `src/hooks/useWarehouseItems.ts` — same swap to `get_warehouse_items_list`.
- `src/hooks/useWarehouseAssets.ts` — same swap to `get_warehouse_assets_list`.

Existing TS types (`WarehouseTool` etc. in `src/types/toolManagement.ts`) are unchanged — the mapping layer keeps the API stable.

#### D) Approval Console RPC tightening

`get_approval_console` already exists. Audit it for two things:
1. Confirm it filters `company_id` early (uses the new partial index).
2. Add `LIMIT` parameter so the client can paginate instead of always fetching everything.

Migration: drop+recreate `get_approval_console(p_company_id uuid, p_limit int default 200)` with the same return shape + new `LIMIT` clause.

#### E) `EXPLAIN ANALYZE` verification (read-only)

Before/after numbers captured for:
- `SELECT * FROM warehouse_items WHERE company_id = $1 ORDER BY created_at DESC LIMIT 5000`
- `rpc get_warehouse_tools_list`
- `rpc get_approval_console`

Captured via `supabase--read_query` and added as comments to the migration file for future reference.

### Files

**New migrations**
- `supabase/migrations/<ts>_phase4_composite_indexes.sql` — all `CREATE INDEX` statements (CONCURRENTLY-safe via `IF NOT EXISTS`).
- `supabase/migrations/<ts>_phase4_list_rpcs.sql` — `get_warehouse_tools_list`, `get_warehouse_items_list`, `get_warehouse_assets_list`, updated `get_approval_console`.

**Modified**
- `src/hooks/useWarehouseTools.ts` — swap to RPC + flat-row mapping.
- `src/hooks/useWarehouseItems.ts` — swap to RPC.
- `src/hooks/useWarehouseAssets.ts` — swap to RPC.
- `src/hooks/useApprovalConsole.ts` — pass `p_limit` parameter.

**Memory**
- New: `mem://performance/db-index-strategy` — "Every multi-tenant list query has `(company_id, created_at DESC)`. Approval/pending queries use partial indexes. New hot lists must add an index in the same migration."
- New: `mem://architecture/list-rpc-pattern` — "Hot list endpoints (>1k rows or multi-table joins) use `SECURITY INVOKER` RPCs returning flat rows; never embed via PostgREST `select('*, fk(*)')` for hot paths."
- Update Core line in `mem://index.md`.

### Out of scope (later phases)

- **Phase 5**: `web-vitals` reporter + Lighthouse CI budget + perf regression alerts.
- Materialized **views** (vs RPCs) — defer until traffic actually warrants pre-computation; RPCs + indexes will hit our latency targets first.
- Cursor-based pagination for >5k row lists — current limit + virtualization handles 14k comfortably; revisit if datasets cross 50k.

### Verification

1. `EXPLAIN ANALYZE` on warehouse_items list: planning + execution time drops from current baseline (captured in migration comments) to <150 ms at 14k rows.
2. Tool Management page: Network tab shows a single RPC request returning a flat array; payload size matches Phase 2 narrow-select expectation; first contentful paint of the table <500 ms.
3. Approval Console initial load: total request time <500 ms (was ~2 s).
4. `supabase--linter` after migration shows zero "unindexed foreign key" warnings on the touched tables.
5. Realtime updates still refresh lists within ~1 s (Phase 2 bus + debounce intact).
6. RLS still enforced: a user with no `company_id` access to a row gets zero results from the new RPCs (verified with a test query as a non-admin user).
7. No client-side regressions: virtualized tables (Phase 3) render the new flat rows identically to the old embedded shape.

