# Phase 2 — PEPPOL E-Invoicing Core (UBL 2.1 Schema + Builder + Supplier Quote Flow)

## Context
Phase 1 (database tables for supplier portal: `supplier_users`, `supplier_invitations`, `peppol_participants`, `supplier_profiles_extended`, `supplier_portal_audit`, helpers, RLS, storage bucket) is applied. Edge functions and `/portal/*` UI from Phase 1 were not built — Phase 2 will pick those up alongside the e-invoicing schema, since the portal is the surface where suppliers submit invoices that drive the PEPPOL pipeline.

Phase 3 (live Storecove AP send/receive, AS4 webhooks, MLR/BLR) and Phase 4 (country-specific mandates: SA ZATCA, IN IRP, IT SDI, MX CFDI) remain out of scope.

## Goal
Stand up the canonical e-invoice domain (tables, RLS, storage, hash-chained events), a UBL 2.1 / PEPPOL BIS Billing 3.0 builder edge function that produces validated XML (no network send yet), the supplier portal shell + invite/accept flow, and the Sourcing-side supplier quote ingestion. Outputs are stored UBL XML files that pass schematron locally — ready for Phase 3 to ship to Storecove.

## Deliverables

### 1. Database migration — e-invoicing core
New tables (all `company_id` scoped, RLS):
- `einvoices` — header: direction (`outbound` | `inbound`), `supplier_id`, `customer_company_id`, `invoice_number`, `issue_date`, `due_date`, `currency`, `subtotal`, `tax_total`, `grand_total`, `status` (`draft` | `validated` | `ready_to_send` | `sent` | `received` | `accepted` | `rejected` | `paid`), `peppol_message_id`, `ubl_xml_path` (storage), `pdf_path`, `po_id`, `grn_id`, `match_status`, `created_by`.
- `einvoice_lines` — `einvoice_id`, `line_no`, `item_code`, `description`, `quantity`, `unit`, `unit_price`, `line_extension`, `tax_category`, `tax_rate`, `tax_amount`, `po_line_id`.
- `einvoice_attachments` — file metadata + storage path (PDF, supporting docs).
- `einvoice_events` — append-only, hash-chained (`prev_hash`/`row_hash` like `supplier_portal_audit`): `event_type` (`created`, `validated`, `submitted`, `ack_received`, `rejected`, `matched`, `posted`), `actor_user_id`, `payload jsonb`, `ip`, `user_agent`.
- `supplier_quotes` (Sourcing bridge) — links `rfq_id` ↔ `supplier_id` with `quote_number`, `valid_until`, `currency`, `total`, `status`, `submitted_by_user_id`, plus `supplier_quote_lines`.

Indexes: `(company_id, status, created_at DESC)`, `(supplier_id, issue_date DESC)`, `(po_id)`, `(peppol_message_id)`.

Triggers: `einvoice_events` hash-chain trigger (mirror of `supplier_portal_audit_hash`); `set_updated_at` on all mutable tables; status-transition guard function rejecting illegal transitions.

RLS:
- Internal admins/AP/finance roles: full company-scoped CRUD.
- Suppliers (`is_supplier_member`): SELECT own outbound + own quotes; INSERT outbound drafts + quotes (owner/contributor); never see other suppliers.
- Append-only enforcement on `einvoice_events` (no UPDATE/DELETE, even for admins).

Storage: private bucket `einvoices` with path `{company_id}/{einvoice_id}/ubl.xml` (+ `pdf/`, `attachments/`). RLS scoped on `foldername(name)[1] = company_id` for internal, supplier-owned subset for suppliers.

### 2. Edge functions (Deno, JWT-verified, Zod-validated, CORS, rate-limited)
- `supplier-invite` (admin) — generates invite token, hashes, inserts `supplier_invitations`, sends email via existing transactional email pathway. Audit via `log_supplier_portal_event`.
- `supplier-accept-invite` (public) — verifies token+expiry, creates auth user, links to `supplier_users`, redirects to `/portal/mfa`.
- `peppol-build-invoice` (internal + supplier owner) — input `{ einvoice_id }`. Loads header+lines+supplier+customer+PEPPOL participants, builds UBL 2.1 XML (PEPPOL BIS Billing 3.0 / EN 16931 profile) using a vendored UBL template module, runs structural validation (required fields, totals reconciliation, currency, party identifiers, tax categories), writes XML to storage, sets status `validated`, appends `einvoice_events` row. Returns XML path + validation report.
- `peppol-validate-invoice` (read-only) — re-runs validation on stored XML; used by retry flows. No network calls.

All four functions: structured logging, return uniform error envelope, no service_role key on client, no path-style invocation.

### 3. Frontend — Supplier Portal shell
New route tree under `/portal/*` (separate `PortalLayout`, no admin sidebar):
- `/portal/accept-invite?token=…`
- `/portal/login`, `/portal/mfa` (reuses existing MFA challenge components)
- `/portal/dashboard` — quote/PO/invoice counters
- `/portal/profile`, `/portal/users`, `/portal/peppol-ids`
- `/portal/quotes` (list + submit-against-RFQ)
- `/portal/invoices` — list, draft, attach PDF, validate, view UBL preview/XML

Components:
- `SupplierRoute` — guards: must be authenticated, must have `supplier` role and an active `supplier_users` row. Non-supplier → `/`.
- `SupplierContext` — exposes current supplier, role (`owner`|`contributor`|`viewer`), permission helpers.
- Hooks: `useSupplierProfile`, `useSupplierUsers`, `useSupplierInvitations`, `useSupplierQuotes`, `useSupplierEinvoices`, `useEinvoiceLines`.
- Reuse existing `VirtualTable`, `StatusBadge`, design tokens.

Internal admin surface:
- New tab in **Sourcing → Supplier Registration**: "Portal Access" — invite/revoke users, view audit, manage PEPPOL IDs.
- New module entry in `src/constants/moduleConfig.ts` for `/portal` (hidden from internal sidebar; documented for routing).

### 4. Sourcing & Procurement integration (read-only bridge for now)
- Quotation Comparison page picks up `supplier_quotes` alongside legacy quotes (union view).
- Procurement PO detail dialog: badge "Supplier acknowledged on portal" if a `supplier_quotes` row references the PO source RFQ.
- Finance AP: new "PEPPOL Invoices" sub-tab listing `einvoices` (read-only this phase). Posting/3-way match wiring stays in Phase 3.

### 5. Compliance & security
- All new edge functions JWT-verified in code; supplier endpoints check `is_supplier_member(supplier_id)`.
- Tax ID and bank account fields written via `peppol-build-invoice` are read from `supplier_profiles_extended`; column-level encryption deferred to Phase 3 (documented).
- Hash-chain integrity check helper RPC `verify_einvoice_event_chain(einvoice_id)` for audit dashboards.
- Store every state transition + actor in `einvoice_events`; never mutate or delete.
- Memories to add: `mem://features/einvoicing/ubl-builder-standards`, `mem://security/einvoice-append-only-events`.

## Out of Scope
- Live Storecove AS4 send/receive, MLR/BLR webhooks (Phase 3).
- Inbound parsing + auto 3-way match wiring (Phase 3).
- Country-specific mandates and CIUS profiles (Phase 4).
- Column-level encryption (`pgsodium`).
- DSAR export.

## Acceptance Criteria
- Migration applies with no new linter regressions in Phase 2 tables.
- `peppol-build-invoice` produces UBL 2.1 XML that passes EN 16931 / PEPPOL BIS 3.0 schema + structural validation against fixture invoices.
- Supplier can accept invite → log in (with MFA when role=owner) → submit a quote → draft an invoice → see validated UBL preview.
- Internal admin can invite/revoke supplier users and see hash-chained audit.
- Non-supplier users blocked from `/portal/*`; suppliers blocked from internal routes.
- All RLS verified: cross-supplier and cross-company access denied in tests.
