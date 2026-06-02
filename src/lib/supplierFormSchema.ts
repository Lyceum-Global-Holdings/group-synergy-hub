// Supplier Registration form schema (international baseline).
// Aligned with PEPPOL/EN 16931 (party identifiers), ISO 20022 (banking),
// ISO 17442 (LEI), ISO 9362 (BIC), ISO 4217 (currency), ISO 3166-1 (country),
// GS1 (GLN) and GDPR consent.

export type SupplierFieldType =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "textarea"
  | "checkbox"
  | "file";

export interface SupplierFileValue {
  path: string;
  name: string;
  size: number;
  mime: string;
  uploaded_at?: string;
}

export type SupplierFieldGroup =
  | "identity"
  | "tax"
  | "contact"
  | "address"
  | "banking"
  | "compliance"
  | "custom";

export interface SupplierFieldOption {
  label: string;
  value: string;
}

export interface SupplierField {
  /** Stable key. Baseline keys are reserved; custom keys are prefixed `custom_`. */
  key: string;
  label: string;
  type: SupplierFieldType;
  group: SupplierFieldGroup;
  required: boolean;
  visible: boolean;
  /** Baseline fields cannot be removed, only toggled visible/required. */
  baseline?: boolean;
  placeholder?: string;
  help?: string;
  options?: SupplierFieldOption[];
  pattern?: string;
  patternMessage?: string;
  min?: number;
  max?: number;
  /** File upload constraints (only used when type === "file"). */
  accept?: string[];
  maxSizeMB?: number;
  multiple?: boolean;
  maxFiles?: number;
  /** Optional display order within section (lower = earlier). */
  order?: number;
}

export interface SupplierSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  fields: SupplierField[];
}

export interface SupplierFormSchema {
  version: number;
  sections: SupplierSection[];
}

// ISO 9362 BIC: 8 or 11 chars
export const BIC_PATTERN = "^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$";
// ISO 17442 LEI: 20 chars
export const LEI_PATTERN = "^[A-Z0-9]{18}[0-9]{2}$";
// E.164 phone
export const E164_PATTERN = "^\\+?[1-9][0-9]{6,14}$";
// IBAN basic shape (server should mod-97 verify)
export const IBAN_PATTERN = "^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$";
// PEPPOL participant id: scheme::value (e.g. 0192::123456789)
export const PEPPOL_PATTERN = "^[0-9]{4}::.+$";

export const DEFAULT_SUPPLIER_FORM_SCHEMA: SupplierFormSchema = {
  version: 1,
  sections: [
    {
      id: "identity",
      title: "Company Identity",
      description: "Legal identifiers used across procurement and e-invoicing.",
      order: 1,
      fields: [
        { key: "supplier_name", label: "Legal Company Name", type: "text", group: "identity", required: true, visible: true, baseline: true, placeholder: "ABC Corporation Ltd." },
        { key: "trading_name", label: "Trading / DBA Name", type: "text", group: "identity", required: false, visible: true, baseline: true },
        { key: "supplier_type", label: "Supplier Type", type: "select", group: "identity", required: true, visible: true, baseline: true, options: [
          { label: "Vendor", value: "vendor" },
          { label: "Manufacturer", value: "manufacturer" },
          { label: "Distributor", value: "distributor" },
          { label: "Service Provider", value: "service_provider" },
          { label: "Contractor", value: "contractor" },
        ]},
        { key: "country", label: "Country", type: "text", group: "identity", required: true, visible: true, baseline: true, help: "ISO 3166-1 country name", placeholder: "Sri Lanka" },
        { key: "registration_number", label: "Business Registration Number", type: "text", group: "identity", required: false, visible: true, baseline: true },
        { key: "lei", label: "LEI (ISO 17442)", type: "text", group: "identity", required: false, visible: false, baseline: true, pattern: LEI_PATTERN, patternMessage: "20-character LEI", help: "Legal Entity Identifier" },
        { key: "duns", label: "DUNS Number", type: "text", group: "identity", required: false, visible: false, baseline: true },
        { key: "gln", label: "GS1 GLN", type: "text", group: "identity", required: false, visible: false, baseline: true, help: "Global Location Number (13 digits)" },
        { key: "peppol_id", label: "PEPPOL Participant ID", type: "text", group: "identity", required: false, visible: false, baseline: true, pattern: PEPPOL_PATTERN, patternMessage: "Format: scheme::value (e.g. 0192::123456789)" },
        { key: "website", label: "Website", type: "url", group: "identity", required: false, visible: true, baseline: true, placeholder: "https://example.com" },
      ],
    },
    {
      id: "tax",
      title: "Tax & Regulatory",
      order: 2,
      fields: [
        { key: "tax_id", label: "Tax ID / VAT / GST Number", type: "text", group: "tax", required: false, visible: true, baseline: true },
        { key: "tax_residency", label: "Tax Residency Country", type: "text", group: "tax", required: false, visible: false, baseline: true },
      ],
    },
    {
      id: "contact",
      title: "Primary Contact",
      order: 3,
      fields: [
        { key: "primary_contact_name", label: "Contact Name", type: "text", group: "contact", required: true, visible: true, baseline: true },
        { key: "email", label: "Email", type: "email", group: "contact", required: true, visible: true, baseline: true },
        { key: "phone", label: "Phone (E.164)", type: "tel", group: "contact", required: true, visible: true, baseline: true, pattern: E164_PATTERN, patternMessage: "Use international format e.g. +94771234567" },
      ],
    },
    {
      id: "address",
      title: "Business Address",
      order: 4,
      fields: [
        { key: "street_address", label: "Street Address", type: "text", group: "address", required: true, visible: true, baseline: true },
        { key: "city", label: "City", type: "text", group: "address", required: true, visible: true, baseline: true },
        { key: "state_province", label: "State / Province", type: "text", group: "address", required: false, visible: true, baseline: true },
        { key: "postal_code", label: "Postal Code", type: "text", group: "address", required: false, visible: true, baseline: true },
      ],
    },
    {
      id: "banking",
      title: "Banking Details (ISO 20022)",
      order: 5,
      fields: [
        { key: "bank_name", label: "Bank Name", type: "text", group: "banking", required: false, visible: true, baseline: true },
        { key: "bank_account_holder", label: "Account Holder", type: "text", group: "banking", required: false, visible: true, baseline: true },
        { key: "iban", label: "IBAN", type: "text", group: "banking", required: false, visible: false, baseline: true, pattern: IBAN_PATTERN, patternMessage: "Invalid IBAN format" },
        { key: "bank_account_number", label: "Account Number", type: "text", group: "banking", required: false, visible: true, baseline: true },
        { key: "swift_code", label: "BIC / SWIFT (ISO 9362)", type: "text", group: "banking", required: false, visible: true, baseline: true, pattern: BIC_PATTERN, patternMessage: "8 or 11 character BIC" },
        { key: "currency", label: "Currency (ISO 4217)", type: "text", group: "banking", required: false, visible: false, baseline: true, placeholder: "USD" },
      ],
    },
    {
      id: "compliance",
      title: "Compliance & Consent",
      order: 6,
      fields: [
        { key: "business_description", label: "Business Description", type: "textarea", group: "compliance", required: false, visible: true, baseline: true },
        { key: "sanctions_declaration", label: "I confirm the company is not subject to international sanctions.", type: "checkbox", group: "compliance", required: true, visible: true, baseline: true },
        { key: "gdpr_consent", label: "I consent to the processing of the data submitted for supplier onboarding (GDPR Art. 6).", type: "checkbox", group: "compliance", required: true, visible: true, baseline: true },
      ],
    },
  ],
};

export function fieldKeysFromSchema(schema: SupplierFormSchema): string[] {
  return schema.sections.flatMap((s) => s.fields.map((f) => f.key));
}

export function visibleFields(schema: SupplierFormSchema): SupplierField[] {
  return schema.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((s) => s.fields.filter((f) => f.visible));
}

export function mergeWithBaseline(saved: SupplierFormSchema | null | undefined): SupplierFormSchema {
  if (!saved || !saved.sections?.length) return DEFAULT_SUPPLIER_FORM_SCHEMA;
  const baselineMap = new Map<string, SupplierField>();
  DEFAULT_SUPPLIER_FORM_SCHEMA.sections.forEach((s) =>
    s.fields.forEach((f) => baselineMap.set(f.key, f)),
  );
  // Ensure every baseline field still exists (admins can hide but not delete).
  const sections = saved.sections.map((s) => ({
    ...s,
    fields: s.fields.map((f) => {
      const base = baselineMap.get(f.key);
      if (base) baselineMap.delete(f.key);
      // For baseline fields, key + type are locked to preserve standards mapping,
      // but every other admin-edited prop (label, help, placeholder, options,
      // validation, file constraints, visibility, required, order) must survive
      // round-trips through save/reload.
      return base
        ? {
            ...base,
            ...f,
            key: base.key,
            type: base.type,
            baseline: true,
            group: base.group,
            label: f.label || base.label,
          }
        : f;
    }),
  }));
  // Re-add any baseline fields that were missing.
  baselineMap.forEach((f) => {
    const target = sections.find((s) => s.id === f.group) || sections[0];
    target.fields.push(f);
  });
  return { ...saved, sections };
}
