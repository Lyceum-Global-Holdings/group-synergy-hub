

# Fix: RLS violation on `warehouse_items` insert

## Root Cause

The INSERT RLS policy on `warehouse_items` requires `created_by = auth.uid()`. The `AddFromCatalogDialog.tsx` insert (line 88-112) does not set `created_by`, so it fails the policy check.

## Change

### `src/components/warehouse/AddFromCatalogDialog.tsx`

Add `created_by` to the insert payload. This requires fetching the current user's ID first (via `supabase.auth.getUser()` or using an existing auth hook).

Add to the insert object at line ~109:
```typescript
created_by: (await supabase.auth.getUser()).data.user?.id,
```

This is a one-line fix that resolves the RLS violation.

