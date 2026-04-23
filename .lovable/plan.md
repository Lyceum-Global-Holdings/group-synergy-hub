

## Move Category Between Groups (Re-parent / Reclassify)

Add a "Move" action on each category so a user can relocate it under a different parent (or promote it to a Level 0 root). This is the standard SAP MM "Reclassify Material Group" pattern and aligns with **ISO 55000** (asset hierarchy maintenance) and **ISO/IEC 25010** reliability principles — change hierarchy without delete/recreate.

### Behavior

- New **Move** icon (folder-arrow) next to Edit / Delete on every visible category row.
- Opens a `MoveCategoryDialog` showing:
  - Source: current category (name, code, current parent path breadcrumb).
  - Destination: searchable parent picker showing the full Level 0 + Level 1 tree with indentation, plus a top option **"— Move to Top Level (Level 0) —"**.
  - Read-only impact summary: *"X subcategories will move with this category"*.
  - Confirm / Cancel.
- On confirm: single `UPDATE item_categories SET parent_id = <new> WHERE id = <source>`. Items linked to the category are unaffected (they reference `category_id`, not the parent path).

### Validation rules (enforced client + DB)

1. **No self-parent**: cannot pick itself as new parent.
2. **No cycles**: cannot pick any of its own descendants as new parent. Computed in the picker (descendants are filtered out + greyed with tooltip "Would create a cycle").
3. **Max depth = 2 (Level 0 + Level 1 only)** to match the rest of the warehouse UI: a Level 0 with children cannot be moved *under* another Level 0 (would push children to Level 2). Show inline error.
4. **Global vs company scope**: a global category (`company_id IS NULL`) can only be re-parented to another global category (or top level). Company-owned categories can be re-parented to any visible parent. Prevents leaking company data into the global tree.
5. **Permissions**: same rule as Edit — admin / super_admin / moderator only.

### Database — depth + cycle guard trigger

Belt-and-braces server-side enforcement (frontend bug should never corrupt the tree again, per the recent closure-bug incident):

```sql
CREATE OR REPLACE FUNCTION public.enforce_item_category_hierarchy()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_depth int := 0;
  v_cursor uuid := NEW.parent_id;
BEGIN
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Category cannot be its own parent';
  END IF;

  -- Walk up; reject cycles and depth > 1 (root=0, child=1)
  WHILE v_cursor IS NOT NULL LOOP
    IF v_cursor = NEW.id THEN
      RAISE EXCEPTION 'Move would create a cycle in category tree';
    END IF;
    v_depth := v_depth + 1;
    IF v_depth > 1 THEN
      RAISE EXCEPTION 'Category hierarchy is limited to 2 levels (Level 0 and Level 1)';
    END IF;
    SELECT parent_id INTO v_cursor FROM public.item_categories WHERE id = v_cursor;
  END LOOP;

  -- If this category itself has children, it must remain at Level 0
  IF NEW.parent_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.item_categories WHERE parent_id = NEW.id) THEN
    RAISE EXCEPTION 'Cannot move a parent category under another category (would exceed 2 levels)';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_item_category_hierarchy
BEFORE INSERT OR UPDATE OF parent_id ON public.item_categories
FOR EACH ROW EXECUTE FUNCTION public.enforce_item_category_hierarchy();
```

### Hook — new mutation in `useItemCategories.ts`

```ts
const moveCategoryMutation = useMutation({
  mutationFn: async ({ id, newParentId }: { id: string; newParentId: string | null }) => {
    const { error } = await supabase
      .from('item_categories')
      .update({ parent_id: newParentId })
      .eq('id', id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['item-categories', companyId] });
    toast({ title: 'Category moved', description: 'Hierarchy updated successfully.' });
  },
  onError: (e: any) => {
    toast({ title: 'Move failed', description: e.message ?? 'Could not move category.', variant: 'destructive' });
  },
});
```

Exposes `moveCategory`, `isMoving`.

### UI changes

| File | Change |
|---|---|
| `src/components/warehouse/MoveCategoryDialog.tsx` | **New.** Source breadcrumb + destination picker (hierarchical, indented), validation, confirm. |
| `src/components/warehouse/CategoryTreeItem.tsx` | Add `onMove?: (category) => void` prop and a Move icon button (lucide `FolderInput`) between Edit and Delete; tooltip "Move to another group". Hidden in `isHidden` mode and for global categories when no company is selected. |
| `src/components/warehouse/ItemCategoriesTab.tsx` | Track `movingCategory` state; render `MoveCategoryDialog`; pass `onMove={setMovingCategory}` to both visible and hidden tree renders (move disabled in hidden tree). |
| `src/hooks/useItemCategories.ts` | Add `moveCategoryMutation` + return `moveCategory`, `isMoving`. |
| `supabase/migrations/<ts>_item_categories_hierarchy_guard.sql` | **New.** Trigger above. |

### What does NOT change

- `parent_id` column, RLS, FK rules (`ON DELETE SET NULL` stays).
- Items / SKUs assigned to the moved category — unaffected (they keep their `category_id`).
- Hidden / exclude / restore / bulk visibility flows.
- Other category pickers (Item form, Inventory filter, Tools dropdown) — they auto-reflect the new tree because they read from the same source.

### Standards alignment

- **SAP MM** Material Group reclassification (move, don't delete/recreate).
- **ISO 55000** asset hierarchy maintenance — preserve identity through reorganization.
- Project memory: `warehouse-category-code-mnemonic-standard`, `shared-foundational-components`, `form-data-normalization`.

