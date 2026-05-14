---
name: Supplier Registration Public Portal
description: Public supplier registration link is generated from configurable per-company base URL plus company slug; form fields are admin-editable via versioned schema
type: feature
---
- Per-company canonical URL stored in `supplier_portal_settings.public_base_url`. Page resolves: settings → published custom domain (`https://stores.lgh.lk`) → `window.location.origin`, with `?c=<lower(company.code)>` slug.
- Form fields are admin-editable via `supplier_registration_form_config` (versioned, one published row per company). Baseline fields cannot be deleted; only toggled visible/required. Custom fields use `custom_*` keys and persist into `supplier_data` JSON.
- Public RPCs `resolve_public_portal_company(slug)` and `get_published_supplier_form(slug)` are SECURITY DEFINER, granted to anon, and return only non-PII metadata.
- Edge function `public-supplier-registration` accepts `company_slug` (preferred) or `company_id`, resolves via the RPC, and stores `company_id` on the registration. Validation uses passthrough zod schema so admin-added fields are accepted.
- Baseline schema lives in `src/lib/supplierFormSchema.ts` and aligns with PEPPOL/EN 16931, ISO 20022 (IBAN/BIC), ISO 17442 (LEI), GS1 (GLN), and GDPR consent.
