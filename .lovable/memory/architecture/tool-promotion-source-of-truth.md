---
name: tool-promotion-source-of-truth
description: Tool import dialog must read from warehouse_item_catalog (master) not warehouse_items (stock); company/location are destinations only
type: preference
---
Tool promotion ("Import from Item Master" → `warehouse_tools`) must source candidates from `warehouse_item_catalog` (the global Item Master), never from `warehouse_items` (the company stock layer).

**Why:** `warehouse_items` is the inventory layer — it excludes catalog rows that were never stocked, were zeroed out, or live only in the global catalog. Sourcing from it silently hides thousands of valid candidates.

**How to apply:**
- Candidate RPC: `get_tool_catalog_candidates` reads from `warehouse_item_catalog` and LEFT JOINs `warehouse_items` only as a *non-filtering* inventory snapshot for the selected target company/location.
- Company and location in the dialog are **destinations** for the new tool rows — they must NOT restrict which catalog rows are visible.
- Provenance: every imported tool must set `warehouse_tools.catalog_item_id` to the source catalog row. Per-company uniqueness is enforced by partial unique index `warehouse_tools_company_catalog_uniq (company_id, catalog_item_id) WHERE catalog_item_id IS NOT NULL`.
- Duplicate exclusion in the picker: prefer `catalog_item_id` first, fall back to `(company_id, tool_code)` only for legacy rows with `catalog_item_id IS NULL`.
- Tool category subtree must be collected recursively from `TOO-HND` / `TOO-PWR` roots — not just direct children — because `category_id = ANY(...)` is exact-match.
