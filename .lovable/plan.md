# Supplier Registration: Public Link + Editable Form

Two improvements to `/sourcing/supplier-registration`, designed to align with international supplier-onboarding standards (ISO 20022 supplier onboarding data, PEPPOL/EN 16931 party identifiers, ISO 20022 IBAN/BIC banking, GDPR consent, GS1 GLN where applicable).

---

## 1. Domain-aware public registration link

Today the link is `${window.location.origin}/n`, so an admin on the preview/staging domain copies a non-canonical URL.

**Approach**
- Store a per-company canonical public portal base URL in a new table `supplier_portal_settings` (`company_id`, `public_base_url`, `is_active`, audit cols). Super admin / company admin can edit.
- Resolution order on the page: `supplier_portal_settings.public_base_url` → project custom domain (`stores.lgh.lk`) → `window.location.origin`. Always rendered as `${base}/n?c=${companySlug}` so the public portal can scope the submission to the correct company.
- Public route `/n` reads `?c=` and resolves the company server-side via a SECURITY DEFINER RPC (`resolve_public_portal_company(slug)`), avoiding RLS leaks.
- Add a "Configure public URL" dialog next to Copy/Preview, with HTTPS validation and live preview.
- Optional QR code (reuse existing QR utilities) for printed onboarding packs.

**Why standards-aligned**: a stable canonical URL is required for PEPPOL/Tungsten-style supplier directory listings and for embedding in tenders/RFx invitations.

---

## 2. Admin-editable registration form

Replace the hard-coded steps (`BasicInfoStep`, `BusinessDetailsStep`, `BankingDetailsStep`, `ReviewStep`) with a config-driven renderer.

**Schema**
- New table `supplier_registration_form_config` (`company_id`, `version`, `is_published`, `schema jsonb`, audit cols). Only one published version per company; older versions retained for audit (regulator requirement under GDPR Art. 30).
- `schema` shape (JSON Schema-inspired, kept small):
  ```
  { sections: [{ id, title, order, fields: [{
      key, label, type, required, visible, editable,
      group: 'identity'|'tax'|'banking'|'compliance'|'custom',
      validation: { pattern, min, max, options },
      help, sensitive  // sensitive => masked + audit-logged
  }]}]}
  ```
- Seed with the **international baseline** (cannot be removed, only toggled required/visible):
  - **Identity**: legal name, trading name, supplier type, country (ISO 3166-1 alpha-2), LEI (ISO 17442), DUNS, GS1 GLN, PEPPOL participant ID (`scheme::value`).
  - **Tax**: VAT/GST number with country-aware regex (EU VIES format, GCC TRN, etc.), tax residency.
  - **Contact**: primary contact, email, E.164 phone.
  - **Banking** (ISO 20022): account holder, IBAN (mod-97 check), BIC/SWIFT (ISO 9362), bank name, currency (ISO 4217), intermediary bank optional.
  - **Compliance**: sanctions self-declaration, beneficial owner (UBO) >25%, GDPR consent checkbox + timestamp, code-of-conduct acknowledgement.
- Admins can additionally add **custom fields** (text, number, date, select, multiselect, file). Custom answers stored in `supplier_data.custom_fields` jsonb.

**Form Builder UI** (new tab "Form Builder" on the page)
- List sections, drag to reorder, toggle visible/required/editable per field.
- Add custom field dialog with type, options, validation, help text.
- "Preview" renders the public form exactly as suppliers will see it.
- "Publish" bumps version and flips `is_published`; previous versions stay queryable.

**Renderer**
- New `DynamicSupplierForm` component used by both the internal wizard and the public `/n` page. Reads the published config via a public RPC `get_published_supplier_form(company_slug)` (no auth, returns only the published schema — no PII).
- Validation centralised in `src/lib/supplierFormValidation.ts` (IBAN, BIC, LEI, PEPPOL ID, VAT regex per country).
- Existing typed columns (`email`, `tax_id`, etc.) continue to be written from baseline fields; custom fields land in `supplier_data.custom_fields`.

**Security**
- Form config edits restricted by RLS to admins of the owning company; public RPC returns only published, non-sensitive metadata.
- Turnstile remains on the public form (existing memory rule); edge function `public-supplier-registration` validates submissions against the published schema server-side to prevent field tampering.

---

## Technical changes

```text
DB (single migration)
├── supplier_portal_settings              (new)
├── supplier_registration_form_config     (new, jsonb schema, versioned)
├── companies.slug                        (add if missing, unique)
├── RPC resolve_public_portal_company(slug)
├── RPC get_published_supplier_form(slug)
└── RLS: admin-only writes, public read of published config only

Frontend
├── src/pages/sourcing/SupplierRegistration.tsx     (URL resolver + Configure dialog + Form Builder tab)
├── src/components/sourcing/registration/FormBuilder.tsx                (new)
├── src/components/sourcing/registration/DynamicSupplierForm.tsx        (new, replaces step components for rendering)
├── src/components/sourcing/SupplierRegistrationWizard.tsx              (use DynamicSupplierForm)
├── src/pages/PublicSupplierRegistration.tsx                            (use DynamicSupplierForm + ?c= slug)
├── src/lib/supplierFormValidation.ts                                   (new: IBAN/BIC/LEI/VAT/PEPPOL)
├── src/hooks/useSupplierFormConfig.ts                                  (new)
└── src/hooks/useSupplierPortalSettings.ts                              (new)

Edge function
└── supabase/functions/public-supplier-registration/index.ts            (validate against published schema)
```

## Out of scope
- Multi-language form translations (can follow once the schema is in place).
- Supplier self-service updates after approval.
- Migrating historical submissions to the new schema (old records keep current shape; renderer handles both).

## Open question
Should the public link be **per-company** (one link per legal entity, recommended for multi-tenant cleanliness) or **global with company picker on the form**? The plan above assumes per-company; tell me if you'd prefer global.
