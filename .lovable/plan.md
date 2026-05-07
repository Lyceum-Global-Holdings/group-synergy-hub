# PEPPOL Phase 4 — Country Mandates, Credit Notes, Production Toggle, Compliance

Builds on Phase 3 (Storecove transmission, webhook, inbound parsing, 3-way match). Phase 4 turns the system into a multi-jurisdiction, production-ready e-invoicing platform.

## Scope

1. **Credit notes & corrections** — UBL CreditNote 2.1 (doc type 381), linked to original invoice, full lifecycle parity with invoices.
2. **Country mandates** — pluggable adapters for KSA ZATCA Phase 2, IT SDI (FatturaPA), FR Factur-X / Chorus Pro.
3. **Production toggle** — per-company sandbox/live switch for the access point with audit trail.
4. **Attachment encryption at rest** — encrypt PDF/UBL attachments stored in the `einvoices` bucket with AES-GCM, keys via Vault.
5. **DSAR / compliance export** — admin tool to export all e-invoice records + events for a counterparty (GDPR Art. 15 / 20).
6. **Archival & retention** — 10-year immutable archive policy enforcement (cold tier + legal hold).

Out of scope: real-time clearance models beyond KSA/IT (e.g. Mexico CFDI, Chile DTE), supplier-onboarding self-service for portal admins.

## Architecture

```text
                ┌────────────────────────────────────┐
                │ peppol-build-invoice (router)      │
                │  ├─ profile=peppol-bis  → UBL 2.1  │
                │  ├─ profile=ksa-zatca   → ZATCA    │
                │  ├─ profile=it-sdi      → FatturaPA│
                │  └─ profile=fr-facturx  → Factur-X │
                └────────────────────────────────────┘
                              │
                              ▼
                ┌────────────────────────────────────┐
                │ peppol-send (env-aware)            │
                │  reads company.peppol_environment  │
                │  routes sandbox/live Storecove     │
                └────────────────────────────────────┘

┌──────────────────────┐   ┌──────────────────────┐
│ peppol-credit-note   │   │ peppol-dsar-export   │
│ links to original    │   │ admin compliance pkg │
└──────────────────────┘   └──────────────────────┘
```

## Database changes

Migration `phase4_peppol_mandates_compliance`:

- Extend `einvoices`:
  - `document_type` enum (`invoice`, `credit_note`, `debit_note`) default `invoice`.
  - `corrected_einvoice_id uuid` (FK self, nullable) for credit-note linkage.
  - `compliance_profile` enum (`peppol_bis_3`, `ksa_zatca_phase2`, `it_sdi`, `fr_facturx`) default `peppol_bis_3`.
  - `archive_until date` (computed default = created_at + 10 years).
  - `legal_hold boolean` default false.
- Extend `companies`:
  - `peppol_environment` enum (`sandbox`, `live`) default `sandbox`.
  - `peppol_live_enabled_at timestamptz`, `peppol_live_enabled_by uuid` (audit).
  - `country_mandate_overrides jsonb` (per-country cert refs, endpoint URLs).
- New table `einvoice_country_artifacts`:
  - `einvoice_id`, `mandate` (`zatca`/`sdi`/`facturx`), `qr_code text`, `clearance_uuid text`, `clearance_status`, `government_response jsonb`, `cleared_at`.
- New table `einvoice_attachment_keys`:
  - `attachment_id` (FK), `key_id` (Vault reference), `iv bytea`, `auth_tag bytea`, `algorithm text` default `AES-256-GCM`.
- Append-only trigger on `einvoice_country_artifacts`.
- RLS: company-scoped (admin/finance read; supplier portal read own).

## Edge functions

1. **`peppol-build-invoice`** (extended): branches on `compliance_profile`. Adds builders:
   - `buildKsaZatca(einvoice)` — ZATCA Phase 2 UBL with embedded QR (TLV) and PIH chain hash.
   - `buildItSdi(einvoice)` — FatturaPA XML 1.2.2 (different schema, separate namespace).
   - `buildFrFacturx(einvoice)` — UBL 2.1 + PDF/A-3 hybrid via `pdf-lib`.
2. **`peppol-credit-note`** (new, admin): clones a source invoice, flips signs, sets `document_type='credit_note'`, links via `corrected_einvoice_id`, builds CreditNote-2 UBL, appends `credit_note_issued` event.
3. **`peppol-clearance-zatca`** (new, server-to-server): submits to ZATCA Fatoora, stores clearance UUID + QR.
4. **`peppol-clearance-sdi`** (new): submits to Italian SDI via Storecove SDI channel; handles 5-day acceptance window.
5. **`peppol-attachment-encrypt`** / **`peppol-attachment-decrypt`** (new, internal): wraps Storage put/get with AES-GCM via Vault DEKs.
6. **`peppol-dsar-export`** (new, admin): builds a ZIP with all `einvoices`, `einvoice_lines`, `einvoice_events`, `einvoice_transmissions`, `einvoice_match_results` for a given supplier or customer; signed URL valid 24h.
7. **`peppol-send`** (modified): chooses sandbox vs live Storecove endpoint based on `companies.peppol_environment`; refuses to send `live` unless `peppol_live_enabled_at` is set and the calling user is `super_admin`.

## Frontend

- **Finance AP → PEPPOL Invoices**:
  - "Issue Credit Note" row action on `posted` invoices → opens dialog (reason, lines selector).
  - Mandate badge column (PEPPOL / ZATCA / SDI / Factur-X).
  - QR preview for ZATCA invoices.
  - "Compliance Export" admin action → triggers `peppol-dsar-export`.
- **Company Settings → E-invoicing tab** (new):
  - Sandbox/Live toggle (super-admin only) with confirmation modal listing prerequisites.
  - Country mandate enablement matrix (KSA / IT / FR) with cert upload references.
  - Retention policy display (10y) and legal-hold count.
- **Supplier portal → Invoices**: credit-note linkage shown inline; download links transparently decrypt attachments.

## Secrets required

- `ZATCA_CSID_USERNAME`, `ZATCA_CSID_PASSWORD`, `ZATCA_PRODUCTION_CSID` (per-company override possible).
- `SDI_TRANSMITTER_ID`.
- `EINVOICE_ATTACHMENT_KEK` (key-encryption-key for envelope encryption).
- Reuses Phase 3 `STORECOVE_API_KEY`, `STORECOVE_WEBHOOK_SECRET`. Add `STORECOVE_LIVE_API_KEY` for production tenant.

Functions degrade gracefully with a clear "mandate not configured" error until secrets are present.

## Acceptance criteria

- Credit note can be issued from a posted invoice; original invoice shows the link; UBL CreditNote validates against EN 16931 BR-CO rules.
- A KSA-profiled invoice produces ZATCA-compliant UBL with QR (TLV base64) and is accepted by the ZATCA sandbox; clearance UUID stored.
- An IT-profiled invoice produces FatturaPA XML accepted by Storecove SDI sandbox; SDI status transitions reflected via webhook.
- A FR-profiled invoice produces a hybrid PDF/A-3 with embedded UBL.
- Sandbox→Live toggle requires super-admin and writes an `einvoice_events` audit row scoped to the company.
- New attachments are stored AES-256-GCM encrypted; retrieval transparent for authorized users; raw bucket bytes are unreadable.
- DSAR export ZIP contains a complete, hash-chained record set for the requested counterparty.
- Migration applies cleanly; supabase linter has no new warnings.

## Implementation order

1. DB migration (enums, columns, new tables, triggers, RLS).
2. Credit-note builder + UI action + lifecycle events.
3. Country adapters: ZATCA → SDI → Factur-X (each behind feature flag).
4. Attachment encryption layer (encrypt-on-write, decrypt-on-read), backfill skipped (only new files).
5. Production toggle + super-admin gate + audit.
6. DSAR export function + admin UI.
7. Memory entries: `features/einvoicing/credit-notes`, `features/einvoicing/country-mandates`, `security/peppol-attachment-encryption`, `security/peppol-production-toggle`.

## Confirmation needed before coding

- **Country priority**: default order KSA → IT → FR. Adjust if a specific tenant needs another first (e.g. PL KSeF, DE XRechnung).
- **Encryption KEK**: use `EINVOICE_ATTACHMENT_KEK` secret (envelope encryption with per-file DEK), or integrate with an external KMS (AWS KMS / GCP KMS)?
- **Retention**: 10 years default; confirm or override per jurisdiction (e.g. KSA = 6y, IT = 10y, FR = 10y).
- **Live toggle gate**: require super-admin only, or also a second-person approval (4-eyes)?
