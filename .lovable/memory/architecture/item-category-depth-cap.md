---
name: item-category-depth-cap
description: item_categories tree is capped at 3 levels (depth 0–2); enforced by trigger enforce_item_category_hierarchy and mirrored in client move guards
type: feature
---
The `public.item_categories` tree is bounded at **3 levels (depth 0, 1, 2)** — root, child, grandchild.

**Why:** `STANDARD_INDUSTRY_TEMPLATES` (e.g. `Clothing → Men's Apparel → Shirts`, `TOO-HND → Hammers → Claw Hammers`) and the Phase 9 tool import flow both depend on grandchildren existing. The previous 2-level cap blocked legitimate imports while leaving older grandchildren grandfathered in the data, creating a contradictory schema.

**How to apply:**
- DB enforcement: trigger `enforce_item_category_hierarchy` on `BEFORE INSERT OR UPDATE OF parent_id`. Rejects ancestor depth > 2, self-parenting, and cycles. On move, also walks the moved node's descendant subtree and rejects when `targetDepth + 1 + subtreeHeight > 2`.
- Client mirror: `useItemCategories.moveCategoryMutation` performs the same depth-aware check before the network round-trip, so the UI fails fast with the same wording.
- Pickers must walk the full subtree (no `parent_id IS NULL` shortcuts). Reference: `src/features/tools/lib/toolCategories.ts::buildToolCategoryOptions` (recursive walker, depth capped at 2 for indentation).
- Import surfaces the real DB error message in the failure toast — never a generic "Failed to import categories" — so future schema mismatches stay visible.
- Do NOT raise the cap to 4+ without auditing every flat picker, breadcrumb, and code-mnemonic generator (codes follow `ROOT-CHILD-GRANDCHILD`, e.g. `CLO-MEN-SHT`).
