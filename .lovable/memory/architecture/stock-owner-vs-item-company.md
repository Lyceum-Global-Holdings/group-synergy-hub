---
name: Stock Owner as Free-Text Label
description: Stock Owner = warehouse_bin_allocations.stock_owner (text). Free-typed label, decoupled from companies. Never combined with company_id (which remains for tenant isolation).
type: architecture
---

Stock Owner is a **free-text label** stored in `warehouse_bin_allocations.stock_owner` (nullable text). It is typed by users, not chosen from a list of companies. `NULL` is rendered as the badge "Unassigned".

Distinct from:
- **Item Master Company** — `warehouse_items.company_id` (catalog row owner per tenant).
- **Tenant isolation** — `warehouse_bin_allocations.company_id` (still required, drives RLS/visibility).

The Stock Owner label never combines with any ID. Filters, badges, and the bulk-change dialog all operate on the plain text value.

### Reader
`list_warehouse_inventory` accepts `_owner_label text` and returns `stock_owners text[]` (distinct labels visible per item in the current location scope; `NULL` surfaced as `"Unassigned"`). Matching is case-insensitive (`ILIKE`).

### Writer
`bulk_change_stock_owner(_item_ids uuid[], _from_owner text, _to_owner text, _location_ids uuid[])`
- `_to_owner` is required (trimmed); `_from_owner` may be NULL to target unassigned stock.
- `_location_ids` is mandatory — system-wide ownership changes are forbidden.
- Admin/super_admin only. Merges into existing rows when `(item, bin, location, company, to_owner)` already exists.

### UI
- Inventory tab "Stock Owner" filter: debounced free-text `<Input>` (no dropdown).
- Bulk Update dialog "Stock Owner filter": free-text `<Input>`.
- Change Stock Owner dialog: two free-text `<Input>` fields (From / To), scoped to the selected location and its sub-locations.
