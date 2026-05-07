---
name: peppol-production-toggle
description: Sandbox/Live PEPPOL environment is per-company; live sends require super_admin and a recorded peppol_live_enabled_at timestamp
type: constraint
---
- `companies.peppol_environment` defaults to `sandbox`. Switching to `live` MUST go through the security-definer RPC `set_peppol_environment(company_id, env)`, which enforces `super_admin` and stamps `peppol_live_enabled_at` / `peppol_live_enabled_by`.
- `peppol-send` reads the company environment and:
  - For `live`, requires the calling user to have `super_admin` AND `peppol_live_enabled_at IS NOT NULL`, otherwise refuses.
  - Selects the API key: `STORECOVE_LIVE_API_KEY` for live (falls back to `STORECOVE_API_KEY` if unset), `STORECOVE_API_KEY` for sandbox.
- Never expose this toggle in supplier-portal UI; it is admin-only in main app settings.

**Why:** Live PEPPOL transmissions are legally binding tax documents. Accidental live sends from sandbox testing must be impossible without explicit super-admin opt-in and audit trail.
