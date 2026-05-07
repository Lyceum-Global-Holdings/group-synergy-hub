---
name: einvoice-append-only-events
description: einvoice_events table is append-only, hash-chained; never UPDATE or DELETE rows from any layer
type: constraint
---
The `einvoice_events` table is the tamper-evident audit trail for PEPPOL e-invoices.

Rules:
- INSERT only. UPDATE/DELETE are blocked by trigger `einvoice_events_no_update`.
- Each row's `row_hash` is a SHA-256 of `prev_hash || einvoice_id || event_type || actor_user_id || payload || created_at`, computed by trigger `einvoice_events_hash`. Never set `row_hash` from the client.
- Use `public.log_einvoice_event(p_einvoice_id, p_event_type, p_payload, p_ip, p_user_agent)` from edge functions.
- Use `public.verify_einvoice_event_chain(p_einvoice_id)` to detect tampering in audit dashboards.
- Status transitions on `einvoices` MUST be accompanied by a corresponding event row (created/validated/submitted/ack_received/rejected/matched/posted/cancelled).

**Why:** PEPPOL/EN 16931 + ISO 27001 A.8.15 require non-repudiable audit logs for outbound and inbound invoices.
