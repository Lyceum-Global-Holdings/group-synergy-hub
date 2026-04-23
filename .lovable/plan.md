

## Admin-only "Delete Tool" in Tool Management

### Outcome

Admins (and higher) can delete tools from the Tools Inventory tab. Non-admins do not see the action. Deletion is blocked at the database level for non-admins and blocked in both UI and DB when the tool still has active (unreturned) issues, preserving audit history.

### Standards applied

- **ISO 27001 A.9.4.1 / A.9.4.4** — least privilege; destructive operations restricted to privileged roles, enforced server-side (RLS), not just client-side.
- **SAP MM equipment retirement / ISO 55000** — physical assets are not deleted while in use; require all units returned before removal.
- **GDPR Art. 5(1)(e) + ISO 27001 A.12.4** — preserve audit trail. Historical `tool_issues` / `tool_returns` rows are kept; only the master record is removed (or soft-deleted, see below).
- **WCAG 2.2 SC 3.3.4** — destructive actions require a confirmation step naming the item.
- **Project memory** `user-role-delete-restriction` and `admin-authorization-server-side` — admin gating must be server-side; client gating is UX only.

### Database layer (server-side enforcement)

Replace the over-permissive DELETE policy on `warehouse_tools` (currently `auth.uid() IS NOT NULL`).

Migration:

1. Drop existing DELETE policy `Users can delete warehouse tools`.
2. Create a new DELETE policy: requires `has_role(auth.uid(), 'admin')` OR `has_role(auth.uid(), 'super_admin')` AND `can_access_company(company_id)` (or `company_id IS NULL`). Mirrors the existing SELECT scope so admins of other companies can't reach across tenants.
3. Add a trigger `prevent_tool_delete_with_active_issues` (BEFORE DELETE on `warehouse_tools`) that raises an exception if any `tool_issues` row exists with `quantity_issued > quantity_returned` for the tool. Message: `Cannot delete tool: N units are still issued. Process returns first.`

The historical `tool_issues` and `tool_returns` rows are retained (their `tool_id` becomes orphaned only if FK is `ON DELETE CASCADE` — verify and switch to `ON DELETE RESTRICT` or `SET NULL` so audit history survives). Plan: set `ON DELETE SET NULL` on `tool_issues.tool_id` and `tool_returns.tool_id`, with a denormalized `tool_code_snapshot` / `tool_name_snapshot` already on the issue rows where present (verify; if not, add nullable snapshot columns populated by an INSERT trigger).

### Client layer

#### `src/hooks/useWarehouseTools.ts`

- `deleteToolMutation` already exists. Add explicit verification per project memory `warehouse-asset-deletion-verification`:
  - Run `.delete().eq('id', id).select('id')` and throw if no row returned (RLS blocked).
- Surface the trigger error message verbatim in the toast.

#### `src/components/warehouse/tools/ToolsInventoryTab.tsx`

- Accept new prop `onDeleteTool?: (tool: WarehouseTool) => void`.
- Import `useIsAdminOrHigher`.
- In the row action `DropdownMenu`, conditionally render a **Delete Tool** item (red text, `Trash2` icon) only when `canDelete` is true AND `tool.issued_quantity === 0` (UI guard mirroring the trigger).
- When `tool.issued_quantity > 0` and the user is admin, show the item disabled with tooltip "Return all issued units before deleting."

#### `src/pages/warehouse/ToolManagement.tsx`

- Add state: `selectedToolForDelete`, `showDeleteTool`.
- Pass `onDeleteTool` to `ToolsInventoryTab`.
- Render the existing shared `DeleteConfirmationDialog` from `src/components/admin/DeleteConfirmationDialog.tsx` (already in the design system) with:
  - `title`: "Delete tool"
  - `itemName`: `${tool.tool_code} — ${tool.name}`
  - `description`: "This permanently removes the tool master record. Historical issues and returns are preserved for audit."
  - `destructiveText`: "Delete tool"
  - `isLoading`: bound to `isDeleting`
  - `onConfirm`: call `deleteTool(tool.id)`; close dialog on success.

#### Cache & realtime

- The existing `onSuccess` in `deleteToolMutation` invalidates `['warehouse-tools']` — sufficient (project uses `staleTime: 0`).

### Out of scope

- No soft-delete column added (full delete is acceptable because audit history lives in `tool_issues`/`tool_returns`). Can be added later if regulators require restore.
- No bulk delete (single-row only for safety in v1).
- No changes to `tool_adjustments` (kept for audit; FK switched to `SET NULL` if currently CASCADE).

### Verification

1. As a `user` role: open Tool Management → row menu does NOT show Delete; direct API call `.delete()` returns 0 rows.
2. As `admin`: row with `issued_quantity = 0` → Delete visible → confirm dialog shows code+name → row removed; toast "Tool deleted successfully".
3. As `admin`: row with `issued_quantity > 0` → Delete disabled with tooltip; if forced via API, trigger raises clear error.
4. After deletion, the `tool_issues` history for that tool is still queryable (audit preserved).
5. Cross-company: admin of Company A cannot delete a tool belonging to Company B.

### Files

- New migration — RLS policy replacement + trigger + FK adjustment.
- `src/hooks/useWarehouseTools.ts` — verification on delete.
- `src/components/warehouse/tools/ToolsInventoryTab.tsx` — admin-gated Delete menu item.
- `src/pages/warehouse/ToolManagement.tsx` — wire confirmation dialog.

