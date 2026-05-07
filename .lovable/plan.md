# PEPPOL Phase 3 — Transmission, Receipts, Inbound Parsing, 3-Way Match

Builds on Phase 2 (canonical e-invoice tables, UBL builder, supplier portal). Phase 3 makes invoices actually leave and enter the system over the PEPPOL network and reconciles them against POs and GRNs.

## Scope

1. **Outbound transmission** — submit `validated` UBL XML to the access point (Storecove) and track delivery state.
2. **Inbound webhook** — receive PEPPOL messages + Message Level Responses (MLR) and Business Level Responses (BLR/Invoice Response) from the access point.
3. **Inbound UBL parser** — turn received UBL XML into `einvoices` + `einvoice_lines` rows (`direction='inbound'`).
4. **3-way match** — auto-link inbound invoices to PO/GRN, compute `match_status` and discrepancies.
5. **UI surface** — Finance AP "PEPPOL Invoices" tab gets actions (Send, View XML, View match), supplier portal invoices tab shows live status from MLR/BLR.

Out of scope (Phase 4): country-specific mandates (KSA ZATCA, IT SDI, FR Factur-X), credit notes, attachment encryption at rest, DSAR export.

## Architecture

```text
┌─────────────────┐  validated UBL   ┌──────────────────┐
│ peppol-build    │─────────────────▶│ peppol-send      │──┐
└─────────────────┘                  └──────────────────┘  │
                                                           │ AS4
                                  ┌──────── Storecove ────┘
                                  │
                       MLR/BLR    ▼
                ┌──────────────────────────┐
                │ peppol-webhook (public)  │──▶ einvoice_events
                └──────────────────────────┘     status updates
                          │ inbound invoice
                          ▼
                ┌──────────────────────────┐
                │ peppol-ingest-inbound    │──▶ einvoices(direction=inbound)
                └──────────────────────────┘     einvoice_lines
                          │
                          ▼
                ┌──────────────────────────┐
                │ peppol-three-way-match   │──▶ match_status + report
                └──────────────────────────┘
```

## Database changes

Migration `phase3_peppol_transmission`:

- New table `einvoice_transmissions`:
  - `einvoice_id` (FK), `provider` ('storecove'), `provider_message_id`, `direction`,
    `submitted_at`, `last_status`, `last_status_at`, `attempt_count`, `error_message`, `raw_response jsonb`.
- Extend `einvoice_status` enum with `submission_failed`, `delivered` (idempotent `ALTER TYPE`).
- New table `einvoice_match_results`:
  - `einvoice_id`, `po_id`, `grn_id`, `total_match`, `qty_match`, `price_match`,
    `discrepancies jsonb`, `score numeric`, `evaluated_at`.
- Indexes: `(provider_message_id)` unique partial, `(einvoice_id, evaluated_at DESC)`.
- RLS: admin full; suppliers may read their own transmissions/match results (via `is_supplier_member`).
- Append-only trigger on `einvoice_transmissions` (no UPDATE/DELETE; only INSERT new rows per state change).

## Edge functions

All functions: `verify_jwt = false`, validate JWT in code (admin-only) except the public webhook.

1. **`peppol-send`** (admin): loads `einvoices` row in `validated` status, reads `ubl_xml_path` from Storage, POSTs to Storecove `/document_submissions`, writes a row in `einvoice_transmissions`, sets status `ready_to_send` → `sent`, appends `submitted` event.
2. **`peppol-webhook`** (public, HMAC-verified via `STORECOVE_WEBHOOK_SECRET`): handles event types `invoice.delivered`, `invoice.received`, `invoice.mlr`, `invoice.blr`, `invoice.failed`. Updates `einvoice_transmissions.last_status`, transitions `einvoices.status`, appends `ack_received` / `rejected` / `delivered` events.
3. **`peppol-ingest-inbound`** (internal, called by webhook for received UBL): downloads UBL from Storecove, parses with vendored XML walker (no schema validation here — that's the Phase 2 builder's job; we trust receipt), inserts `einvoices(direction='inbound', status='received')` + `einvoice_lines`, stores XML in `einvoices` bucket under `inbound/{message_id}.xml`.
4. **`peppol-three-way-match`** (admin or invoked by ingest): finds candidate PO via `peppol_message_id` → buyer reference, GRN via PO. Computes line-by-line qty/price tolerance (configurable, defaults: ±5% qty, ±2% price, ±1 unit currency). Writes `einvoice_match_results`, sets `einvoices.match_status`, appends `matched` event.

## Frontend

- **Finance AP → PEPPOL Invoices tab** (existing read-only): add row actions
  - "Send" (visible when `status='validated'`) → invokes `peppol-send`.
  - "View UBL" → signed-URL download.
  - "Match details" → drawer showing `einvoice_match_results` line-by-line table.
  - Status badge supports the new states.
- **Supplier portal → Invoices**: add a status timeline panel reading `einvoice_events` (filtered to non-internal types) and a "Download UBL" link for own invoices.

## Secrets required

- `STORECOVE_API_KEY`
- `STORECOVE_WEBHOOK_SECRET`
- (later, for sender identity) `STORECOVE_SENDER_LEGAL_ENTITY_ID`

Phase 3 can scaffold all functions and DB without these set; `peppol-send` and the webhook will return a clear "provider not configured" error until they are added.

## Acceptance criteria

- Migration applies cleanly; no new RLS gaps in linter.
- `peppol-send` posts a validated invoice and persists provider message ID; status moves to `sent`.
- Mocked webhook payloads transition status and append events without breaking the hash chain.
- Inbound UBL with mandatory BIS 3.0 headers parses into `einvoices` + lines.
- `peppol-three-way-match` flags qty mismatch as `discrepancy`, exact match as `matched`.
- Supplier portal shows live status updates after a webhook call.
- Finance AP "Send" button works end-to-end against a Storecove sandbox tenant.

## Implementation order

1. DB migration (tables, enum extensions, RLS, append-only trigger).
2. `peppol-send` + UI "Send" action + transmission viewer.
3. `peppol-webhook` skeleton + HMAC verification + status transitions.
4. `peppol-ingest-inbound` + UBL parser.
5. `peppol-three-way-match` + match drawer UI.
6. Supplier portal status timeline.
7. Memory entries: `architecture/peppol-transmission`, `security/peppol-webhook-hmac`.

## Confirmation needed before coding

- **Provider**: defaulting to **Storecove**. Confirm or pick another (Pagero, Tickstar, Tradeshift, custom AS4).
- **Sandbox vs live**: Phase 3 wires the sandbox tenant only; production toggle ships in Phase 4.
- **3-way tolerance defaults**: qty ±5%, price ±2%, total ±1 unit currency. Adjust if you have policy.
