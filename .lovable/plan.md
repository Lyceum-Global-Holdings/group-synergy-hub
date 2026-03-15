

# Add Confirmation Summary Before Executing Bulk Import

## Current Behavior
When the user clicks the "Import" button, the import executes immediately. There's already a preview table showing parsed items, but no final confirmation step.

## Plan

### Add a confirmation step between preview and import

**File: `src/components/warehouse/BulkItemImportContent.tsx`**

1. Add a `showConfirmation` state (boolean, default false).

2. When the user clicks "Import", instead of calling `handleImport` directly, set `showConfirmation = true` to show a confirmation summary dialog/card.

3. Render a confirmation summary (as an overlay card or replacing the preview table) that shows:
   - **Items to Create**: count + list of item names/codes
   - **Items to Update (code change)**: count + list showing old code → new code
   - **Items Skipped (duplicates)**: count
   - **Items Skipped (errors)**: count
   - A "Confirm Import" button that calls `handleImport`
   - A "Back" button that sets `showConfirmation = false`

4. The confirmation view uses a clean card layout with sections for each action type, making it easy to review at a glance before committing.

This is a UI-only addition — no backend or logic changes needed.

