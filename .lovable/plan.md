

## Optimistic UI for Move Category with Auto-Rollback

Make the category tree update instantly when a user moves a category, then automatically revert if the server (or DB hierarchy trigger) rejects the change.

### Behavior

- User picks a new parent in `MoveCategoryDialog` and confirms.
- The tree in `ItemCategoriesTab` immediately reflects the new position — no spinner, no flicker.
- If the mutation fails (cycle, depth > 1, RLS, network error, etc.), the tree snaps back to its previous shape and the existing destructive toast appears.
- On success, the cache is reconciled with the server (refetch) so any server-side adjustments are picked up.

### Implementation — `src/hooks/useItemCategories.ts`

Convert `moveCategoryMutation` to use TanStack Query's optimistic update lifecycle (`onMutate` / `onError` / `onSettled`) against the `['item-categories', companyId]` cache.

```ts
const moveCategoryMutation = useMutation({
  mutationFn: async ({ id, newParentId }) => {
    // ...existing client-side guards (self, cycle, depth, scope) stay as-is...
    const { error } = await supabase
      .from('item_categories')
      .update({ parent_id: newParentId })
      .eq('id', id);
    if (error) throw error;
  },
  onMutate: async ({ id, newParentId }) => {
    const key = ['item-categories', companyId];
    // Stop in-flight refetches so they don't overwrite our optimistic snapshot
    await queryClient.cancelQueries({ queryKey: key });

    const previous = queryClient.getQueryData<ItemCategory[]>(key);
    if (previous) {
      queryClient.setQueryData<ItemCategory[]>(
        key,
        previous.map((c) => (c.id === id ? { ...c, parent_id: newParentId } : c)),
      );
    }
    return { previous };  // context for rollback
  },
  onError: (error, _vars, context) => {
    // Roll back to the snapshot
    if (context?.previous) {
      queryClient.setQueryData(['item-categories', companyId], context.previous);
    }
    toast({
      title: 'Move failed',
      description: error?.message ?? 'Could not move category. Reverted.',
      variant: 'destructive',
    });
  },
  onSettled: () => {
    // Reconcile with server on success or failure
    queryClient.invalidateQueries({ queryKey: ['item-categories', companyId] });
  },
  onSuccess: () => {
    toast({ title: 'Category moved', description: 'Hierarchy updated successfully.' });
  },
});
```

Notes:
- All existing client-side validations remain inside `mutationFn` — they throw before any cache mutation, so `onMutate` only runs after the dialog's own pre-checks pass.
- Snapshot is the entire cached `ItemCategory[]` (small array, cheap). Rollback is a single `setQueryData`.
- `onSettled` invalidate is critical: ensures DB trigger errors that bypass client guards are reconciled, and that successful moves pull any server-touched fields (`updated_at`, etc.).

### Dialog behavior — `src/components/warehouse/MoveCategoryDialog.tsx`

Minor adjustment: close the dialog immediately after firing `moveCategory(...)` (don't wait for `isMoving`). The optimistic update means the user sees the result instantly; if it fails, the rollback + toast communicates that, and they can reopen the dialog. If the dialog currently disables the confirm button on `isMoving`, switch it to close-on-click and rely on the toast for failure feedback.

### What does NOT change

- DB schema, RLS, hierarchy trigger.
- Move icon, picker UI, validation rules, or `CategoryTreeItem` rendering.
- Any other mutation (create / delete / exclude / restore / bulk visibility).
- Other cache keys or React Query global config.

### Files modified

| File | Change |
|---|---|
| `src/hooks/useItemCategories.ts` | Add `onMutate` snapshot + optimistic patch and `onError` rollback to `moveCategoryMutation`; move invalidate to `onSettled`. |
| `src/components/warehouse/MoveCategoryDialog.tsx` | Close dialog immediately on confirm so the optimistic update is visible; drop `isMoving` disable on the confirm button. |

### Standards alignment

- TanStack Query canonical optimistic-update pattern (cancel → snapshot → patch → rollback → settle).
- **ISO/IEC 25010** usability (responsiveness) + reliability (fault tolerance — automatic recovery on failure).
- Project memory: `react-query-global-cache-freshness-permanent` (invalidate-on-settle preserves the staleTime: 0 contract).

