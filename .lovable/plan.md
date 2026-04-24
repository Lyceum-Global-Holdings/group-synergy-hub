## Phase 9.3 — Allow 3-level category hierarchy so industry presets and tool subcategories can be imported

### Root cause

The import fails with:

> `Category hierarchy is limited to 2 levels (Level 0 and Level 1)`

This comes from the trigger `enforce_item_category_hierarchy` (migration `20260423052345_*`) which hard-caps the tree at depth 1.

But the system was designed for **3 levels (depth 0–2)**, not 2:

1. `STANDARD_INDUSTRY_TEMPLATES` (`src/constants/standardCategories.ts`) is built as a 3-deep tree:
   `Clothing → Men's Apparel → Shirts`, `Tools (TOO-HND) → Hammers → Claw Hammers`, etc.
2. The DB already contains 65 depth-2 rows and 1 depth-3 row that pre-date the trigger and were grandfathered in — the picker reads them today.
3. Phase 9 explicitly rewrote `src/features/tools/lib/toolCategories.ts` and the `get_tool_catalog_candidates` RPC to walk **all descendants at any depth** because tool leaves live at depth 2. We have a depth-2 reader and a depth-1 writer — that contradiction is the bug.
4. The import dialog's `flattenCategories()` helper produces `level: 0|1|2` rows, sorts them by level, and resolves `parentName` for each, so level-2 inserts are well-formed — they're just rejected.

### Best solution

Lift the cap from 2 levels to **3 levels (depth 0, 1, 2)**, and align both the trigger and client guards on the same number. This:

- Matches what the presets, the existing data, and the Phase 9 tool picker all already assume.
- Keeps a real bound (no unlimited-depth trees, which would break flat pickers and breadcrumbs).
- Fixes "Failed to import categories" without changing the dialog UX.

Do **not** drop the trigger — we still need cycle prevention and an upper bound. Just move the bound from `> 1` to `> 2`, and update the matching error messages and the descendant-shift guard.

### What to change

#### 1) Migration: relax `enforce_item_category_hierarchy` to 3 levels

Replace the function body so it:

- Still rejects self-parenting and cycles.
- Rejects ancestor depth `> 2` instead of `> 1`.
- Replaces the "parent must stay at Level 0" check with: a category that has descendants cannot be moved to a position where any descendant would land below depth 2. Concretely, compute `max_descendant_depth(NEW.id)` (relative to NEW) + new own depth; reject if the resulting subtree would exceed depth 2.
- Updates error messages to say "3 levels (Level 0, 1, 2)".

Trigger binding remains `BEFORE INSERT OR UPDATE OF parent_id`. No data migration needed; existing depth-2 rows already comply, and the lone depth-3 row is left untouched (the trigger only fires on writes — same grandfathering behavior as before).

#### 2) Client guards in `useItemCategories.ts` (`moveCategoryMutation`)

Currently throws "Destination must be a Level 0 category" and "This category has subcategories. Move it to Top Level instead." Replace those with depth-aware checks consistent with the new 3-level cap:

- Compute target depth = (target?.parent_id ? (target's parent's parent_id ? 2 : 1) : 0).
- Compute moved subtree height (max descendant depth below the moved node).
- Reject if `targetDepth + 1 + subtreeHeight > 2` with: "Move would exceed the 3-level category limit."

Keep the cycle and global-vs-company-parent guards as-is.

#### 3) Import dialog (`ImportCategoriesDialog.tsx`)

No structural change — `flattenCategories` already emits correct levels and the bulk import already orders by level. Just:

- Add a small inline note under the count badge: "Up to 3 levels supported."
- Surface the actual DB error message in the failure toast instead of the generic "Failed to import categories", so future schema mismatches are visible. Do this in `useItemCategories.bulkImportCategoriesMutation.onError` by reading `error.message`.

#### 4) Documentation

Update the standard categories memory note (or create one if absent) to record: "Item category hierarchy is capped at 3 levels (depth 0–2). The cap is enforced by trigger `enforce_item_category_hierarchy` and mirrored in client move guards. Tool category roots `TOO-HND`, `TOO-PWR` rely on this — pickers walk to depth 2."

### Files to change

**New migration**
- `enforce_item_category_hierarchy` updated to allow depth ≤ 2 with descendant-aware move check.

**Modify**
- `src/hooks/useItemCategories.ts` — depth-aware move guards; surface real error in import toast.
- `src/components/warehouse/ImportCategoriesDialog.tsx` — add "Up to 3 levels supported" hint.
- `.lovable/memory/architecture/item-category-depth-cap.md` — new memory documenting the 3-level rule.

### Out of scope

- Backfilling or normalizing the existing depth-3 row.
- Changing preset content.
- Touching the tool import flow (Phase 9.x) — it already walks any depth and will benefit automatically.

### Verification

1. Open Item Bin Master → Import Standard Categories → Apparel → Select All → Import.
   - All Level 0, Level 1, and Level 2 categories insert successfully (no trigger error).
2. Repeat for Construction (which contains the `TOO-HND` / `TOO-PWR` subtree the tool picker depends on).
3. In the Tool Management import dialog, the newly imported deep tool categories now appear in the "Tools" scope (Phase 9 recursive walker already handles them).
4. Try to create a 4th-level child via the UI: the trigger rejects with "3 levels (Level 0, 1, 2)".
5. Move a Level 0 category that has Level 2 descendants under another Level 0: rejected by the new descendant-aware guard.
6. Move a leaf category (no children) under a Level 1 parent: succeeds (becomes Level 2).
7. `supabase--linter` reports no new warnings.
