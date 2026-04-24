---
name: list-rpc-pattern
description: Hot list endpoints (>1k rows or multi-table joins) use SECURITY INVOKER RPCs returning flat rows; never PostgREST embed select
type: preference
---
Hot list endpoints (any list with >1k rows or two+ joined tables) must use a `SECURITY INVOKER` RPC returning flat denormalized rows — not PostgREST `select('*, fk(*)')` embeds.

**Why:** Embed selects trigger N+1 planning and per-FK round-trips at scale; a single RPC executes one server-side `LEFT JOIN` and uses the composite `(company_id, created_at DESC)` index.

**How to apply:**
- Name: `get_<entity>_list(p_company_id uuid, ..., p_limit int default 5000)`.
- Use `SECURITY INVOKER` so existing RLS on the base table remains authoritative.
- Always include a `p_limit` parameter (default 5000) — never return unbounded result sets.
- Client hook maps flat rows → embedded shape so consumer types stay stable. Example: `useWarehouseTools` → `get_warehouse_tools_list`.
- Realtime invalidation hooks remain unchanged (still subscribe to base tables via the bus).
- Search predicates inside list RPCs must be a single combined SQL expression — never two PostgREST `.or()` calls (they merge into one OR group, not AND, and silently leak rows past the cursor window).
- Realtime invalidation must be owned by exactly one hook per table; consumer dialogs subscribe only to *related* tables.
- **Lateral joins inside list RPCs must be backed by a btree index on the join key.** For "snapshot" joins where ≥99% of outer rows match 0–1 inner rows (e.g. catalog → inventory snapshot), prefer a `DISTINCT ON (join_key)` CTE over `LEFT JOIN LATERAL ... ORDER BY ... LIMIT 1` — the latter executes a per-row sort that explodes at scale (14k × 14k = statement timeout). Pre-aggregate once, hash-join to the outer query.
