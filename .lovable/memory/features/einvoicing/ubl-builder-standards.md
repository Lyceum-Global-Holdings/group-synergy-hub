---
name: ubl-builder-standards
description: UBL 2.1 builder for PEPPOL BIS Billing 3.0 (EN 16931); single source via peppol-build-invoice edge function
type: feature
---
Outbound e-invoices are built exclusively by the `peppol-build-invoice` edge function.

Standards:
- Profile: `urn:fdc:peppol.eu:2017:poacc:billing:01:1.0`
- Customization: `urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0`
- Schema: UBL 2.1 (`urn:oasis:names:specification:ubl:schema:xsd:Invoice-2`)
- Document type code 380 (Commercial invoice)

Pipeline:
1. Caller passes `{ einvoice_id }`. Function loads header + lines + supplier + customer + primary PEPPOL participants.
2. Structural validation against EN 16931 BR-* rules (mandatory fields, totals reconciliation within 0.01 tolerance).
3. On error → status stays `draft`, validation_report populated, HTTP 422.
4. On success → XML written to `einvoices` storage bucket at `{company_id}/{supplier_id}/{einvoice_id}/ubl.xml`, status moves to `validated`, an `einvoice_events` row of type `validated` is appended.

Authorization:
- Internal admin/super_admin: any company.
- Supplier portal owner: only invoices for their own supplier (verified via `is_supplier_owner`).

No network send happens here — the AS4 send to the PEPPOL Access Point (Storecove) is Phase 3 (`peppol-send`).
