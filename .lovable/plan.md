# Fix: Silent Delete Failure Due to RLS Policy

## What Happened

When you deleted 100 chairs, the system showed a success message ("Successfully deleted 100 assets") but **no rows were actually removed** from the database. This is because Supabase's Row Level Security (RLS) silently returns success even when 0 rows are affected by a delete operation.

The DELETE policy on `warehouse_assets` requires `is_admin(auth.uid())`. If your current session doesn't satisfy this check, the delete completes with no error but removes nothing. The UI then shows "Success" because it only checks for errors, not whether rows were actually deleted.

**Current data in Lyceum Panadura:**

- 460 chairs (should be 360 after deleting 100) = still all there
- 180 tables = correct
- Total: 9,959,460 (inflated because 100 chairs weren't actually removed)

## Fix (Two Parts)

### Part 1: Fix the delete mutations to verify rows were actually deleted

In `src/hooks/useWarehouseAssets.ts`, update both `deleteAssetMutation` and `deleteBulkAssetsMutation` to use `.select()` after `.delete()` so Supabase returns the deleted rows. Then check if the count matches expectations. If no rows were deleted, throw an error so the user sees a failure message instead of a false success.

**Single delete (line 179-206):**

```typescript
mutationFn: async (id: string) => {
  const { data, error } = await supabase
    .from('warehouse_assets')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Asset could not be deleted. You may not have permission.');
  }
},
```

**Bulk delete (line 208-235):**

```typescript
mutationFn: async (assetIds: string[]) => {
  const { data, error } = await supabase
    .from('warehouse_assets')
    .delete()
    .in('id', assetIds)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Assets could not be deleted. You may not have permission.');
  }
  if (data.length < assetIds.length) {
    throw new Error(
      `Only ${data.length} of ${assetIds.length} assets were deleted. Some assets may require admin permission.`
    );
  }
},
```

Also update the bulk delete success message to use actual count:

```typescript
onSuccess: (_, assetIds) => {
  // ... invalidate queries ...
  toast({
    title: "Success",
    description: `Successfully deleted ${assetIds.length} assets`,
  });
},
```

### Part 2: Fix the RLS DELETE policy to allow proper access

The current DELETE policy only allows `is_admin()`. This should also allow users who created the assets or have warehouse access, consistent with the UPDATE policy.

Update the RLS policy via SQL:

```sql
DROP POLICY "Admins can delete warehouse assets" ON warehouse_assets;
CREATE POLICY "Authorized users can delete warehouse assets" 
  ON warehouse_assets FOR DELETE 
  USING (
    is_admin(auth.uid()) 
    OR (auth.uid() = created_by)
    OR (can_access_company(company_id) AND has_warehouse_access(auth.uid()))
  );
```

## Result

- Delete operations will show an error if rows aren't actually removed (no more false success)
- Users with warehouse access can delete assets they have permission to manage
- After this fix, retrying the delete of those 100 chairs will actually remove them, correcting the total value