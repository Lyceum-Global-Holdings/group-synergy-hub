---
name: credit-notes
description: Credit notes are issued via peppol-credit-note edge function; they clone source invoice with negated amounts and link via corrected_einvoice_id
type: feature
---
- Edge function `peppol-credit-note` is the only path to create a credit note. Never insert `document_type='credit_note'` directly from the client.
- Source invoice must be in `sent`, `delivered`, `posted`, or `matched` status; cannot credit a credit note.
- New row gets `document_type='credit_note'`, `corrected_einvoice_id` = source id, `status='draft'`, all monetary fields negated (subtotal, tax_total, grand_total, line_extension, tax_amount).
- Lines are cloned 1:1 with negated `line_extension` and `tax_amount`.
- After creation, the function appends a `credit_note_issued` event to the new invoice's hash chain.
- UBL CreditNote-2 build still goes through `peppol-build-invoice` (router branches on `document_type`).
