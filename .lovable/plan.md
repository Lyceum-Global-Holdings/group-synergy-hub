

# Fix Duplicate Material Issue Notes from Convert Dialog

## Root Cause

The "Issue Materials" button in `ConvertToIssueDialog.tsx` has no protection against double-clicks. When clicked rapidly, `handleConvert` fires twice, creating two separate Material Issue Notes for the same Material Request.

Evidence from the database shows this pattern repeatedly:
- MIN-20260219-001 and MIN-20260219-002 both created for MR-20260219-001 (6 seconds apart)
- MIN-20251029-001 and MIN-20251029-002 both created for MR-20251029-001 (1 second apart)
- MIN-20251024-001 and MIN-20251024-002 both created for MR-20251024-001 (less than 1 second apart)

## Fix

### File: `src/components/warehouse/ConvertToIssueDialog.tsx`

1. **Add a `isConverting` state** to track when the conversion is in progress
2. **Set it to `true`** at the start of `handleConvert` and `false` on completion/error
3. **Disable the "Issue Materials" button** while `isConverting` is true
4. **Show loading text** on the button during conversion (e.g., "Issuing...")

```text
Changes:
- Line 27+: Add `const [isConverting, setIsConverting] = useState(false);`
- Line 47: Add `if (isConverting) return;` guard at start of handleConvert
- Line 48: Add `setIsConverting(true);`
- Line 101+: Add `finally { setIsConverting(false); }` block
- Line 177: Add `disabled={isConverting}` to the Issue Materials button
```

### Cleanup of Existing Duplicates

The user should manually delete the duplicate MIN records from the database. The duplicates are:
- MIN-20260219-002 (duplicate of MIN-20260219-001)
- MIN-20251029-001 (duplicate, the request's `min_id` points to MIN-20251029-002)
- MIN-20251024-002 (duplicate of MIN-20251024-001)

## Summary

- 1 file modified (`ConvertToIssueDialog.tsx`)
- No database migration needed
- Adds loading state to prevent double-click duplicate submissions
