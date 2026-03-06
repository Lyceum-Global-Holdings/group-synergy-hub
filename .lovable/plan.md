

## Fix: "Failed to create location" — Missing Table Grants

### Root Cause

The `warehouse_locations` table has RLS enabled with correct policies, but **no privileges have been granted** to the `authenticated` role. This means all database operations (SELECT, INSERT, UPDATE, DELETE) are denied at the privilege level before RLS policies are even evaluated.

### Plan

**Single migration** to grant the necessary privileges:

```sql
GRANT SELECT, INSERT, UPDATE ON public.warehouse_locations TO authenticated;
GRANT DELETE ON public.warehouse_locations TO authenticated;
```

The existing RLS policies already handle access control:
- **SELECT**: Any authenticated user can view
- **INSERT**: Must set `created_by = auth.uid()`  
- **UPDATE**: Creator or admin only
- **DELETE**: Admin only

No code changes needed — the frontend logic is correct.

