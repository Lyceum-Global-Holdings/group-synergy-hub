## Problem

After clicking **Confirm Receipt** in the *Receive Items* dialog, the Material Issue / Return list page does not reflect the new status (e.g. `completed` / `partially_received`). Same stale-data issue happens after HOD and Management approval inside the details dialog.

## Root cause

`ReceiveItemsDialog` and the approval handlers in `MaterialIssueDetailsDialog` write to `material_issue_notes` / `material_issue_items` successfully, then call a local `fetchIssueDetails()` which only refreshes the open details dialog state. They never invalidate the React Query cache that powers the list page (`['material-issues']`, `['cpo-material-issues']`, `['daily-material-issues']`). The list therefore keeps showing the previous status until a hard reload.

## Fix

1. **`src/components/warehouse/ReceiveItemsDialog.tsx`**
   - After the successful update block (before `onSuccess()`), invalidate:
     - `['material-issues']`
     - `['cpo-material-issues']`
     - `['daily-material-issues']`
     - `['material-issue', issueId]` (if used)
   - Keep existing `material-returns` invalidation.

2. **`src/components/warehouse/MaterialIssueDetailsDialog.tsx`**
   - Import `useQueryClient`.
   - In `handleApproveHOD` and `handleApproveManagement`, after the DB update, invalidate `['material-issues']` (and related keys above) in addition to `fetchIssueDetails()`.

3. **No DB changes.** Status logic, RLS, and triggers are working — only the client cache wasn't being told to refetch.

## Verification

- Open a material issue, click Receive Items, confirm with full quantity → status badge on the list updates to `completed` without manual refresh.
- Partial receipt → list shows `partially_received`.
- HOD / Management approval inside details → list reflects new approval state immediately.
