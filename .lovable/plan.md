## Root cause

The receive flow updates `material_issue_items` first. A DB trigger (`trigger_update_material_issue_note_receipt_status`) reacts and immediately sets the parent note's `status` to `completed` (or `partially_received`). The client then runs the parent `material_issue_notes` UPDATE with `.select().single()`. By that moment the row is already `completed`, which the new RLS policy does **not** allow, so PostgREST returns 0 rows → `PGRST116` → "Failed to receive items".

The item updates and stock movements actually succeed; only the final note stamp (`received_by`, `received_by_name`, `received_date`, `order_completed`) and the toast fail. That's why the row already shows `status = completed` in the DB.

## Fix

Add `completed` to the receiver branch of the UPDATE policy on `material_issue_notes`, so the same user who just triggered the transition can also stamp receipt metadata on the now-completed note.

### Single migration

Drop and recreate the UPDATE policy:

- admins → full update
- creator AND `status = 'draft'` → full update
- `can_access_company(company_id)` AND `status IN ('issued','partially_received','completed')` → update allowed (covers the post-trigger stamp)

No item policy change needed — items are already covered.

No app code changes.

## Verification

- Re-run Receive Items on `MIN-20260526-002`: should now succeed, toast shows success, `received_by/date` populated, status remains `completed`.
- Subsequent attempts to mutate a long-completed note by non-admins are still bounded to the same company (`can_access_company`), and the only fields the UI ever writes here are the receipt stamp fields.
