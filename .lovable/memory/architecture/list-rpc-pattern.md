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
