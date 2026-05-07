# E-Invoicing (PEPPOL / UBL 2.1) + Supplier Self-Service Portal

Goal: deliver standards-compliant e-invoicing and a secure supplier portal where suppliers register, manage their profile, respond to RFQs with quotes, view POs, submit invoices, and track payments — fully integrated with the existing Procurement / Sourcing / Finance modules.

---

## 1. Standards & Compliance Baseline

| Area | Standard | Why |
|------|----------|-----|
| Invoice semantic model | EN 16931 (EU semantic standard) | Mandatory baseline for PEPPOL BIS Billing 3.0 |
| Syntax | UBL 2.1 (OASIS) | Default PEPPOL syntax |
| Transport | PEPPOL eDelivery Network (AS4 / OpenPEPPOL) | Internationally interoperable 4-corner model |
| Identifiers | PEPPOL Participant ID (ISO 6523 schemes, e.g. 0088 GLN, 0184 DK CVR, 0151 ABN) | Required for routing |
| Code lists | UN/CEFACT, UNCL1001 (invoice types), UNCL5305 (VAT categories), ISO 4217 (currency), ISO 3166 (country) | Required by EN 16931 |
| Digital signature (where required: IT/ES/MX/SA/IN) | XAdES-BES on UBL | Country-specific extensions |
| Archival | ISO 14641 / EN 16931-compliant retention 7–10 yrs, WORM-style | Tax law |
| Security | ISO 27001 controls, OWASP ASVS L2, OAuth2 + PKCE for portal | Supplier-facing surface |
| Privacy | GDPR (lawful basis, DSAR, retention) | Supplier PII |

We will NOT operate our own PEPPOL Access Point (AP). We integrate via a certified AP provider (Storecove, Pagero, Tradeshift, Unimaze, or Tickstar/Qvalia) over REST. This is the standard, lowest-risk approach.

---

## 2. Solution Architecture

```text
 ┌──────────────────────────┐         ┌───────────────────────────┐
 │  Supplier Portal (React) │  HTTPS  │  Internal ERP (existing)  │
 │  - separate auth realm   │◀───────▶│  Procurement / Finance    │
 └──────────┬───────────────┘         └─────────────┬─────────────┘
            │ Supabase Auth (supplier role)         │
            ▼                                       ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                    Supabase (Postgres + RLS)                 │
 │  supplier_users, supplier_quotes, einvoices, einvoice_events │
 └─────────┬─────────────────────────────────┬──────────────────┘
           │                                 │
           ▼                                 ▼
 ┌────────────────────┐          ┌──────────────────────────────┐
 │ Edge Fn: peppol-*  │ ───────▶ │ Certified PEPPOL Access Point│
 │ (UBL build, sign,  │  AS4     │   (Storecove / Pagero / etc) │
 │  send, webhook in) │ ◀─────── │                              │
 └────────────────────┘          └──────────────────────────────┘
```

Key principles:
- Supplier portal is the SAME app, but a dedicated route tree (`/portal/*`) and a new `supplier` app role with strict RLS — suppliers see only their own data.
- E-invoicing is implemented as edge functions so secrets (AP API key, signing keys) never reach the browser.
- All inbound/outbound invoices stored canonically in DB; UBL XML retained as immutable artifact in Storage.

---

## 3. Database Changes (new tables)

Schema additions (RLS-enforced, company-scoped where applicable):

- `supplier_users` — links `auth.users` → `suppliers` (many-to-one). Has `role` (owner, contributor, viewer).
- `supplier_invitations` — token-based onboarding (email, expiry, role).
- `supplier_quotes` — supplier-submitted quotes against `rfq_rfp` (header) + `supplier_quote_lines`.
- `peppol_participants` — our company's + suppliers' PEPPOL IDs (`scheme_id`, `participant_id`, validated via SML lookup).
- `einvoices` — header (direction: outbound|inbound, status, supplier_id/customer_id, currency, totals, ubl_storage_path, peppol_message_id, ap_provider, sent_at, ack_at).
- `einvoice_lines` — line items mapped to PO/GRN for 3-way match.
- `einvoice_events` — append-only audit (created, validated, sent, ack, mlr_received, rejected, paid). Hash-chained for tamper evidence.
- `einvoice_attachments` — embedded binary refs (PDF/A-3 visual rendition).
- New storage bucket `einvoices` (private), path `{company_id}/{yyyy}/{mm}/{einvoice_id}.xml`.

App roles: extend `app_role` enum with `supplier`. Add `has_role(uid, 'supplier')` checks in RLS.

RLS pattern for supplier-scoped tables:
```sql
using (
  exists (select 1 from supplier_users su
          where su.user_id = auth.uid()
            and su.supplier_id = <table>.supplier_id)
)
```

Indexes: `(company_id, status, created_at desc)` on `einvoices`, `supplier_quotes`; partial index on `status='pending'`.

---

## 4. Supplier Portal (UI)

Route tree: `/portal`
- `/portal/login` — separate themed login (still Supabase Auth)
- `/portal/onboarding` — accept invitation, complete profile (legal name, tax IDs, PEPPOL ID, bank details, certifications upload)
- `/portal/dashboard` — KPIs: open RFQs, awarded POs, invoices outstanding, payments
- `/portal/rfqs` — list of RFQs visible to this supplier (driven by existing `supplier_allocation`)
- `/portal/rfqs/:id/quote` — submit quote (line-by-line price, lead time, validity, attachments). Reuses `SubmitQuoteDialog` logic but in portal layout.
- `/portal/purchase-orders` — list + acknowledge PO (sets `po.acknowledged_at`)
- `/portal/invoices` — submit invoice against a PO. Two paths:
  1. Manual form (we build the UBL on submit)
  2. Upload existing UBL/PDF (validate against EN 16931)
- `/portal/payments` — remittance advice list
- `/portal/profile` — manage users, banking, certifications

Layout: new `PortalLayout` (no internal sidebar; supplier-branded header), guarded by `SupplierRoute` component — analogous to `AdminRoute.tsx` but checks `supplier` role + active supplier link.

Existing internal screens get a "Pending supplier quotes" panel feeding the existing Quotation Comparison flow.

---

## 5. E-Invoicing Pipeline

### 5.1 Outbound (we bill a customer)
1. Trigger: user clicks "Send via PEPPOL" on a Customer Invoice in Finance/AR, OR automatic on invoice approval.
2. Edge fn `peppol-build-invoice`:
   - Loads invoice + lines + parties from DB
   - Builds UBL 2.1 `<Invoice>` per PEPPOL BIS Billing 3.0 profile (`urn:fdc:peppol.eu:2017:poacc:billing:01:1.0`)
   - Embeds PDF/A-3 visual rendition as `cac:AdditionalDocumentReference`
   - Validates against EN 16931 + PEPPOL Schematron rules (using `@nordic-e-invoice/peppol-validator` or AP provider's pre-validate endpoint)
3. Stores XML in `einvoices` bucket; row in `einvoices` with status `validated`.
4. Edge fn `peppol-send`:
   - Resolves recipient via SML/SMP lookup (AP provider does this)
   - POSTs to AP REST API (e.g. Storecove `/invoices`)
   - Stores `peppol_message_id`; status → `sent`
5. Webhook `peppol-webhook` receives MLR (Message Level Response) + BLR (Business Level Response) → updates status (`acknowledged`, `rejected_by_recipient`) and writes to `einvoice_events`.

### 5.2 Inbound (supplier sends us an invoice via PEPPOL)
1. AP provider posts to `peppol-inbound` webhook.
2. Verify HMAC signature, parse UBL → canonical row in `einvoices` (direction=inbound).
3. Auto-match to PO/GRN (existing 3-way match engine — reuse `three-way-match` logic). If matched within tolerance → route to AP approval queue. Else → exception queue.
4. On approval, post to GL and AP ledger; trigger payment workflow.

### 5.3 Manual / non-PEPPOL fallback
- Supplier portal allows direct invoice submission (form or PDF+UBL upload). System still produces canonical UBL internally so all invoices share one data model.

### 5.4 Webhook security
- Signed HMAC header verification.
- Replay protection: store `(provider, message_id)` uniqueness.
- Idempotency keys on all writes.

---

## 6. AP Provider Choice

Recommend Storecove (REST-first, EU + APAC + LATAM coverage, PEPPOL + country mandates like SA ZATCA, IN IRP, IT SDI, MX CFDI). Alternatives: Pagero, Tickstar, Unimaze. Decision criteria:
- Coverage of the countries where Lyceum operates
- REST API + webhooks (no SOAP/AS4 client to maintain)
- Built-in EN 16931 + Schematron validation
- Sandbox environment for testing

Required secrets (added via add_secret, never in DB):
- `PEPPOL_AP_API_KEY`
- `PEPPOL_AP_WEBHOOK_SECRET`
- `PEPPOL_SENDER_ID` (our participant ID)

---

## 7. Security & Compliance Controls

- **AuthN/AuthZ**: Supplier auth via Supabase Auth; mandatory MFA for portal `owner` role. Session timeout 30 min idle, 8 hr absolute. Password policy NIST 800-63B.
- **RLS**: every supplier-facing table enforces `supplier_users` membership. Cross-supplier reads impossible.
- **Rate limiting** on portal edge functions (per IP + per supplier_id) to mitigate abuse.
- **Input validation**: Zod schemas in every edge function; reject on schema fail with 400.
- **Audit**: append-only `einvoice_events` and existing `audit_logs` for all portal actions. Hash-chained (each row stores `prev_hash`).
- **Encryption**: bank account numbers, tax IDs encrypted at rest using `pgsodium` (column-level).
- **PII minimization** in supplier directory views (already a pattern in this project).
- **Retention**: invoices retained 10 yrs (configurable per company tax jurisdiction); job purges expired invitations and OTP tokens.
- **GDPR**: DSAR export endpoint; right-to-erasure flagged but blocked while legally retained invoices exist.
- **Tamper evidence**: stored UBL is immutable (storage policy denies update/delete); only superseding invoices allowed (credit note workflow).

---

## 8. Integration with Existing Modules

- Sourcing → `supplier_quotes` feeds `Quotation Comparison`
- Procurement → PO acknowledgement updates `purchase_orders.acknowledged_at`
- Warehouse → on GRN, an inbound invoice can be auto-matched
- Finance → inbound approved invoices post to AP ledger; outbound invoices trigger PEPPOL send
- Approvals → reuse central approval RPC for invoice approval workflow
- Module registry → register `supplier-portal` and `e-invoicing` in `src/constants/moduleConfig.ts`
- RBAC → add `supplier` app_role; new module operations for `e-invoicing` (view/send/approve/reject)

---

## 9. Files to Create / Modify

Create:
- Migrations: new tables, enum extension, RLS policies, storage bucket, hash-chain trigger
- `src/pages/portal/*` (Login, Onboarding, Dashboard, Rfqs, RfqQuote, PurchaseOrders, Invoices, Payments, Profile)
- `src/components/portal/PortalLayout.tsx`, `SupplierRoute.tsx`
- `src/pages/finance/EInvoicing.tsx` (internal management screen: outbox, inbox, exceptions, retry)
- `src/components/einvoicing/*` (InvoiceUblPreview, ValidationReport, EventTimeline)
- `src/lib/einvoicing/ubl.ts` (UBL builder), `validators.ts`, `peppolIds.ts`
- Edge functions: `peppol-build-invoice`, `peppol-send`, `peppol-webhook` (inbound + status), `supplier-invite`, `supplier-accept-invite`
- `src/types/einvoice.ts`, `src/types/supplierPortal.ts`

Modify:
- `src/App.tsx` — add `/portal/*` route tree
- `src/constants/moduleConfig.ts` — register new modules
- `src/constants/rbacConfig.ts` — add `supplier` role + e-invoicing operations
- `src/components/auth/*` — supplier-aware redirects
- `mem://index.md` — add memory entries for: PEPPOL AP integration pattern, supplier portal RLS, einvoice immutability

---

## 10. Phased Delivery (recommended order)

1. **Phase 1 — Foundations (this iteration)**: schema + RLS + supplier role + portal shell + login/onboarding + profile; register modules.
2. **Phase 2 — Sourcing flows**: RFQ visibility + quote submission + PO acknowledgement.
3. **Phase 3 — E-invoicing core**: UBL builder, validator, outbound send via AP sandbox, inbound webhook, exceptions UI.
4. **Phase 4 — Hardening**: hash-chain audit, encryption, MFA enforcement, rate limiting, archival policy, country-specific extensions (ZATCA/IN-IRP if needed).

Phase 1 is the largest single deliverable; Phases 2–4 are smaller increments. I will ask you to confirm scope before each phase.

---

## 11. Open Questions (please confirm before build)

1. **AP provider**: shall we proceed with Storecove, or do you have a preferred AP (Pagero, Tickstar, Unimaze, in-country provider)?
2. **Countries in scope**: PEPPOL BIS only, or do we also need SA ZATCA, IN IRP, IT SDI, MX CFDI extensions on day one?
3. **Supplier auth**: Supabase Auth (email + MFA) acceptable, or do you require SSO (Microsoft/Google) for suppliers as well?
4. **Scope of this build**: deliver Phase 1 + Phase 2 now, and Phase 3 (PEPPOL) after AP credentials are provisioned? Or all phases in one go using AP sandbox?

Once you approve and answer the open questions, I will switch to build mode and start with Phase 1 (schema, RLS, supplier role, portal shell).
