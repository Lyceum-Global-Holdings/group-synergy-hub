

## Add: Inline Access Level Editing per Social Media Channel

### What's needed
Currently the access level is set once when granting access and cannot be changed afterward. The user wants to be able to change a user's access level (admin/editor/viewer/analyst) directly from the access management table, per social media account.

### Approach
Add an inline editable `Select` dropdown in the "Access Level" column of the access table. When changed, it updates the `social_media_access` record and logs the change to the activity log.

### Changes — single file

**`src/pages/social-media/AccessManagement.tsx`**

1. Add an `updateAccessMutation` that:
   - Calls `supabase.from("social_media_access").update({ access_level })` for the given record ID
   - Logs an `access_level_changed` entry to `social_media_activity_log` with old and new levels
   - Invalidates the query cache on success

2. Replace the static `Badge` in the "Access Level" column with a `Select` dropdown (only for active records):
   - Shows current level as the selected value
   - On change, fires the update mutation
   - Inactive/revoked rows keep the static badge (read-only)

3. No database changes needed — the `access_level` column already exists and is updatable via existing RLS policies.

### Files to Edit
- `src/pages/social-media/AccessManagement.tsx` — add update mutation + inline select in the access level column

