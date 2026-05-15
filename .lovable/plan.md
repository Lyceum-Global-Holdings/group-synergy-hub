# Edit & delete fields in the Form Builder

## Scope

Frontend-only enhancement to `src/components/sourcing/registration/FormBuilder.tsx`. No schema changes — `SupplierField` already supports everything we need (`label`, `help`, `placeholder`, `options`, `accept`, `maxSizeMB`, `multiple`, `maxFiles`, `pattern`, `patternMessage`).

The split between **baseline** fields (international standards: PEPPOL, ISO 20022, GS1, ISO 17442 LEI, ISO 9362 BIC, ISO 4217 currency, etc.) and **custom** fields drives what is editable. We keep the standards-compliant `key` + `type` of baseline fields locked so submitted data continues to map cleanly to PEPPOL / ISO 20022 / SAP, and only allow safe presentation tweaks. Custom fields are fully editable, can be safely deleted, and can be reordered.

## What changes

### 1. Edit dialog (replaces inline-only controls for power users)

- **Pencil icon** next to every field row in `SectionEditor` opens an `EditFieldDialog`.
- Reuses the same form layout as `AddFieldDialog`, refactored into one shared `FieldFormFields` subcomponent that takes initial values and emits a partial `SupplierField`.
- Behavior:
  - **Custom field** (`baseline !== true`): everything editable — label, type, required, help text, placeholder, select options, file constraints (accept presets, max size, multiple, max files), regex pattern + message. Changing `type` resets type-specific config (options/file props).
  - **Baseline field** (`baseline === true`): `key` and `type` are **read-only** (locked with a small "Standards-compliant — key/type locked" hint). Editable: `label`, `help`, `placeholder`, `required`, `visible`. This preserves PEPPOL/ISO field semantics while letting admins localize wording.
- Validation surfaced inline (label required; for `select` at least one option; for `file` at least one MIME).

### 2. Delete with confirmation

- Custom-field rows get a **trash** icon (already there) wrapped in an `AlertDialog` confirm: *"Delete '{label}'? Submitted data for this field on existing draft requests will become orphaned."*
- Baseline fields **cannot** be deleted (already enforced); the Trash icon is hidden for them. Admins who don't want a baseline field simply toggle **Visible off** (existing behavior). The card description is updated to make this discoverable: *"Baseline fields can be hidden but not deleted to preserve compliance with PEPPOL / ISO 20022 / GS1 standards."*
- A separate **"Restore defaults"** button on the section header re-applies that section's baseline definitions (label/help/visible/required) without touching custom fields. Useful if an admin breaks something in the editor.

### 3. Reorder fields within a section

- Tiny up/down arrow buttons on each field row to move the field up/down inside its section. Persisted as a new optional `order: number` per field; `SectionEditor` sorts by `order ?? index` so existing schemas keep working without a migration. (No DB change — `form_config.schema` is JSON.)

### 4. Key collision & safety

- When adding/editing custom fields, the key is auto-derived from the label and de-duplicated within the schema (`custom_<slug>_<n>`). Key is not user-editable to prevent breaking historical submissions. Editing label does **not** rename the key.
- Type changes on a custom field that has been published trigger a soft warning toast: *"Changing field type may invalidate previously collected values for this field."*

### 5. UX polish

- Replace the row's right-side cluster with a compact action bar: `Visible` toggle, `Required` toggle, `↑` `↓`, `Edit`, `Delete` (custom only).
- Edit/Delete/Reorder actions all flow through the existing `update(...)` reducer so the existing "Save draft / Publish" flow captures them as a single staged change set — no auto-save, no partial state.

## Out of scope

- No DB migration. `supplier_form_configs.schema` is already JSON.
- No drag-and-drop reorder library (keyboard-friendly arrow buttons are sufficient and lighter). Can revisit with `@dnd-kit` later if requested.
- No reordering of sections themselves.
- No field-level conditional visibility ("show X if Y") — separate, larger feature.
- No retroactive rewriting of already-submitted `supplier_registration_requests.supplier_data`.

## Verification

1. Open `/sourcing/supplier-registration` → Form Builder tab.
2. Add a custom **Select** field "Industry" with 3 options → click pencil → change a label and add an option → Save → Preview shows updated options.
3. Edit a baseline field (e.g. "Email"): only label/help/placeholder/required/visible enabled; key + type are read-only. Save and preview reflects the new label.
4. Try to delete a custom field → confirm dialog → row disappears; Cancel keeps it.
5. Use ↑/↓ to reorder two fields within a section → preview reflects new order.
6. Click "Restore defaults" on a section → baseline fields revert; custom fields remain.
7. Save draft, then Publish → fetch `useSupplierFormConfig` returns the new schema; public `/register-supplier?c=…` form renders the changes.
