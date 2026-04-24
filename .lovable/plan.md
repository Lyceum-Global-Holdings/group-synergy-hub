## Phase 9.4 — Stop "missing item" reports by making every catalog row directly findable in Tool Import

### What I verified before planning

I traced `INV-CMP-CBL-0001` end-to-end against the live database and the running preview's network log:

| Check | Result |
|---|---|
| Catalog row exists, `status='active'` | ✅ id `b984cb63…ebd1`, name `"Wire cord"`, category `Components → Cables & Adapters` (`CMP-CBL`) |
| Already imported as a tool for any company | ❌ no rows in `warehouse_tools` |
| `get_tool_catalog_candidates(p_include_all_categories=true, p_target_company_id=Lyceum)` returns it | ✅ 1 of 14,909 rows |
| Live network call from the preview at 10:40:04 | ✅ scope `all`, response contains all 14,909 rows incl. the target |
| Client filter logic (line 282-302 of `ImportFromItemMasterDialog.tsx`) | ✅ would surface it for any substring of code/name |

**So the data is reaching the browser correctly. The bug is no longer a data-source bug — it's a *findability* bug.** The user opens a 14,861-row virtualized list sorted by `name ASC`, scrolls, doesn't see "Wire cord" because it sorts late, doesn't realise search is the answer, and reports the item as missing. The same shape of complaint produced "T jak", "Tile trowels", and now `INV-CMP-CBL-0001`. Fixing this once at the UI level retires the whole class of report.

There is also one real correctness issue worth fixing in this pass: the in-memory search uses raw `includes()`, so a query like `Pvc pipe` (single space) will NOT match the catalog name `   Pvc  pipe-20MM` (leading + double internal spaces). This silently hides legitimately-matching rows.

### Goal

After this phase, a user who knows ANY fragment of an item's code or name (e.g. `cmp-cbl`, `wire`, `wire cord`, even a partial `0001` paste) finds the row in <2 s without scrolling, and never reports a catalog item as "missing" unless it is genuinely absent from `warehouse_item_catalog`.

### Scope (3 surgical changes, all UI/RPC, no schema change)

#### 1. Whitespace-tolerant + diacritic-tolerant client search

`src/components/warehouse/tools/ImportFromItemMasterDialog.tsx`, `filteredItems` memo:

- Normalize both the query and the searched fields with a single helper:
  ```ts
  const norm = (s: string | null | undefined) =>
    (s ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")  // strip accents
      .replace(/\s+/g, " ")             // collapse all whitespace
      .trim();
  ```
- Apply to `searchTerm` once, and to `item_code`, `name`, `description`, `category_name`, `category_code`, `brand`, `barcode`, `sku` per row.
- This fixes `"Pvc pipe"` → `"   Pvc  pipe-20MM"` and equivalent cases the user has been hitting silently.

#### 2. "Jump to item" code-paste field with hard server confirmation

Add a small input next to the search box, labelled `Find by exact code` (placeholder: `e.g. INV-CMP-CBL-0001`).

Behaviour:
- On Enter or button click, call a new RPC `find_catalog_item_by_code(p_code text, p_target_company_id uuid)` (SECURITY INVOKER, single-row return) that:
  - Looks up the exact code in `warehouse_item_catalog` (case-insensitive).
  - Returns: `{ found: bool, status: 'active'|'inactive'|null, already_imported: bool, tool_id: uuid|null, catalog_id: uuid|null }`.
- The dialog reacts based on the response:
  - `found=false` → toast `"Code not found in Item Master."`
  - `status='inactive'` → toast `"Item exists but is inactive — re-activate it in Item Master first."`
  - `already_imported=true` → toast `"Already in Tool Master as <code>"` + a "Show tool" link.
  - Otherwise → set `searchTerm` to the exact code AND scroll the virtualizer to the matching row using `rowVirtualizer.scrollToIndex(idx, { align: 'center' })`, then briefly highlight the row (1.5 s ring).

This means the user gets an authoritative server answer in one click, removing the "is the item missing or am I just not finding it?" ambiguity for good. It also doubles as a self-service diagnostic when this kind of report comes in.

#### 3. Empty-search-result banner upgrade

Today, when `filteredItems.length === 0` the dialog shows a generic "no items match" message. Replace it with an actionable diagnostic that tells the user exactly what's happening:

- If `searchTerm` looks like an item code pattern (regex `/^[A-Z]{2,4}-/i` or contains digits and dashes), suggest the new "Find by exact code" lookup directly inline with a one-click button that runs it.
- If `categoryFilter !== "all"`, show "Category filter is hiding rows — clear it" with a one-click clear.
- If `sourceScope !== "all"`, show "Tool-categories scope hides uncategorized items — switch to All item master" with a one-click switch (re-using the existing alert wording for consistency).

### Out of scope (intentional)

- No schema change. Catalog is correct, RPC is correct, dedup is correct.
- No change to scope-tab behaviour. `"all"` remains the default per Phase 9.2.
- No change to bulk-import or tool creation. Provenance via `catalog_item_id` already works.
- No changes to `warehouse_items` indexes — Phase 9.1 already covered that.

### Files touched

| File | Change |
|---|---|
| `supabase/migrations/<new>.sql` | Create `find_catalog_item_by_code(text, uuid)` RPC; SECURITY INVOKER; STABLE |
| `src/integrations/supabase/types.ts` | Auto-regenerated from new RPC |
| `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx` | Add normalized search, "Find by code" input + handler + scroll-and-highlight, diagnostic empty state |
| `.lovable/memory/architecture/tool-promotion-source-of-truth.md` | Append: "Tool Import dialog must expose a direct code-lookup path (`find_catalog_item_by_code`) so users can confirm presence without scrolling 14k rows" |

### Acceptance criteria

1. Pasting `INV-CMP-CBL-0001` into the new field and pressing Enter scrolls to and highlights the "Wire cord" row in <1 s, with the row already passing the dedup filter.
2. Typing `wire` in the existing search box also surfaces the row instantly (whitespace-tolerant matching).
3. Pasting a genuinely non-existent code (`ZZZ-FAKE-9999`) shows the toast `"Code not found in Item Master."` — proving the dialog is now diagnostic, not silent.
4. Pasting an already-imported code shows `"Already in Tool Master"` with a link, so future "missing" reports for already-promoted items are self-resolved.
5. The 6.3 MB candidate payload is still fetched once per scope/company (no extra round trips for casual browsing — the new RPC only fires on explicit user action).
6. No regression in the existing scope tabs, virtualization, or bulk-import flow.