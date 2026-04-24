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
- **Default picker scope is `"all"` (All item master), NOT `"suggested"`.** ~97% of `warehouse_item_catalog` is uncategorized in production, so a category-gated default silently hides the bulk of the Item Master. Category scopes ("Suggested", "Tool categories") remain as opt-in narrowing only — they must never be the visibility gate.
- Scope tabs show live row counts via `get_tool_catalog_candidate_counts(p_target_company_id, p_tool_category_ids)` — single SECURITY INVOKER RPC returning `{all, tools, suggested}` with the same per-target-company "already imported" exclusion as the candidates RPC.
- **Direct code lookup is mandatory.** Because the catalog has 14k+ rows sorted alphabetically and users repeatedly report items as "missing" when they actually exist but are unreachable by scrolling, the dialog MUST expose a "Find by exact code" finder backed by `find_catalog_item_by_code(p_code, p_target_company_id)`. The RPC returns `{found, status, already_imported, tool_id, …}` so the UI can give an authoritative server-side answer in one click instead of leaving the user guessing.
- **Search must be whitespace + diacritic tolerant.** Catalog data contains leading/trailing spaces and double internal spaces (e.g. `"   Pvc  pipe-20MM"`). Raw `String.includes` silently hides matches. The dialog normalizes both sides via NFKD + accent strip + whitespace collapse before comparing.
