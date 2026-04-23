

## Fix: Deleting Level 1 Category Wipes Out the Level 0 Parent

### Root cause (confirmed via DB + code inspection)

A **closure bug** in `src/components/warehouse/ItemCategoriesTab.tsx` (lines 201–212 and 226–239):

```tsx
<CategoryTreeItem
  category={category}            // root category
  onDelete={() => handleDeleteCategory(category)}  // ← ignores any id passed in
  ...
/>
```

`CategoryTreeItem` recursively renders its own children and forwards the **same** `onDelete` reference. The child calls `onDelete(child.id)` (correct), but the parent's closure throws the argument away and deletes the **root** instead. Any click on a Level 1 trash icon deletes its Level 0 ancestor.

The database is innocent — `item_categories.parent_id` FK is `ON DELETE SET NULL`. When `TOO-PWR` (Power Tools) was wrongly deleted, its children (Drills, Saws, Grinders, etc.) were correctly orphaned with `parent_id = NULL`. They still exist in the DB, just detached.

### The fix

**1. `src/components/warehouse/ItemCategoriesTab.tsx`** — honor the `(categoryId) => void` contract.

Replace the inline closures with a handler that resolves the id back to the actual category before deciding delete vs. hide:

```tsx
const handleDeleteById = (categoryId: string) => {
  const target = allCategories.find(c => c.id === categoryId);
  if (!target) return;
  if (!target.company_id && selectedCompany?.id) {
    excludeCategory(target.id);   // global → hide for this company
  } else {
    deleteCategory(target.id);    // company-owned → real delete
  }
};
```

Then both tree renders pass it directly:
```tsx
onDelete={handleDeleteById}
```
Drop `onDelete={() => handleDeleteCategory(category)}` and `onDelete={() => {}}`.

**2. `src/components/warehouse/CategoryTreeItem.tsx`** — defensive guard (parent-only deletion warning is misleading because of cascading children warning text).

No logic change required; the component already calls `onDelete(category.id)` correctly. Optionally tighten the prop type to `onDelete: (categoryId: string) => void` (already is) — no other callers found.

**3. Restore the deleted "Power Tools" Level 0 category**

Re-create `TOO-PWR / Power Tools` as a global Level 0 (`company_id = NULL`, `parent_id = NULL`), then re-parent the orphaned children (Drills, Saws, Grinders, plus any company-scoped power-tool entries that lost their parent) back under it. Affected rows identified:

| code | name | company_id |
|---|---|---|
| TOO-PWR-DRL | Drills | NULL (global) |
| TOO-PWR-SAW | Saws | NULL (global) |
| TOO-PWR-GRN | Grinders | NULL (global) |
| TOO-PWR-MXT | Mixture | company-scoped |
| TOO-PWR-WKR | Waker Machine | company-scoped |
| TOO-PWR-DRL | Drill | company-scoped |
| TOO-PWR-GNR | General Tools | company-scoped |

Done via a one-shot data update (insert parent, then `UPDATE item_categories SET parent_id = <new TOO-PWR id> WHERE code LIKE 'TOO-PWR-%'`).

**4. (Optional, recommended) Frontend safety rail**

In `deleteCategoryMutation` (`src/hooks/useItemCategories.ts`), refuse to delete a category that has children in the in-memory list, returning a clear toast: *"This category has X subcategories. Delete or reassign them first."* This is belt-and-braces — the real bug is fixed in step 1, but this prevents any future accidental parent deletion. Aligns with **ISO/IEC 25010** (reliability/fault tolerance) and the standard "no implicit cascading delete on hierarchical master data" rule (SAP MM, ISO 55000).

### What does NOT change

- Database schema or FK rules (`ON DELETE SET NULL` is already correct).
- RLS, exclude/restore (hide) flow, bulk visibility dialog.
- Any other category picker, item form, or tools logic.

### Files modified

| File | Change |
|---|---|
| `src/components/warehouse/ItemCategoriesTab.tsx` | Replace closure-bound `onDelete` with id-respecting `handleDeleteById`; both visible and hidden trees |
| `src/hooks/useItemCategories.ts` | Add pre-flight "has children" guard in `deleteCategoryMutation` with clear error toast |
| Data fix (no migration) | Recreate `TOO-PWR / Power Tools` Level 0; re-parent 7 orphaned `TOO-PWR-*` rows |

