// PEPPOL BIS Billing 3.0 / EN 16931 UBL 2.1 builder.
// Loads an einvoice + lines + parties, builds UBL XML, validates structurally,
// stores XML in the `einvoices` storage bucket, sets status -> 'validated',
// appends an einvoice_event. NO network send (Phase 3).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const xmlEscape = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const num = (n: number, dp = 2) => Number(n ?? 0).toFixed(dp);

interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

function validateInvoice(inv: any, lines: any[], supplierPart: any, customerPart: any): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const req = (cond: boolean, code: string, msg: string) =>
    !cond && issues.push({ severity: "error", code, message: msg });

  req(!!inv.invoice_number, "BR-02", "Invoice must have an Invoice number");
  req(!!inv.issue_date, "BR-03", "Invoice must have an Issue date");
  req(!!inv.currency, "BR-05", "Invoice must have a currency code");
  req(lines.length > 0, "BR-16", "Invoice must have at least one Invoice line");
  req(!!supplierPart?.participant_id, "BR-NL-PEPPOL-1", "Supplier PEPPOL participant ID required");
  req(!!customerPart?.participant_id, "BR-NL-PEPPOL-2", "Customer PEPPOL participant ID required");

  // Totals reconciliation
  let calcSubtotal = 0;
  let calcTax = 0;
  for (const l of lines) {
    const ext = Number(l.line_extension ?? l.quantity * l.unit_price);
    const tax = Number(l.tax_amount ?? ext * (Number(l.tax_rate) || 0) / 100);
    calcSubtotal += ext;
    calcTax += tax;
  }
  const calcGrand = calcSubtotal + calcTax;
  const tol = 0.01;
  if (Math.abs(calcSubtotal - Number(inv.subtotal)) > tol) {
    issues.push({ severity: "error", code: "BR-CO-10", message: `Subtotal ${inv.subtotal} does not match line total ${calcSubtotal.toFixed(2)}` });
  }
  if (Math.abs(calcTax - Number(inv.tax_total)) > tol) {
    issues.push({ severity: "error", code: "BR-CO-14", message: `Tax total ${inv.tax_total} does not match calculated ${calcTax.toFixed(2)}` });
  }
  if (Math.abs(calcGrand - Number(inv.grand_total)) > tol) {
    issues.push({ severity: "error", code: "BR-CO-15", message: `Grand total ${inv.grand_total} does not match calculated ${calcGrand.toFixed(2)}` });
  }
  return issues;
}

function buildUBL(inv: any, lines: any[], supplier: any, customer: any, supplierPart: any, customerPart: any): string {
  const linesXml = lines
    .map((l) => `
  <cac:InvoiceLine>
    <cbc:ID>${xmlEscape(l.line_no)}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${xmlEscape(l.unit || "EA")}">${num(l.quantity, 4)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${xmlEscape(inv.currency)}">${num(l.line_extension)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${xmlEscape(l.description)}</cbc:Description>
      <cbc:Name>${xmlEscape(l.description)}</cbc:Name>
      ${l.item_code ? `<cac:SellersItemIdentification><cbc:ID>${xmlEscape(l.item_code)}</cbc:ID></cac:SellersItemIdentification>` : ""}
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${xmlEscape(l.tax_category || "S")}</cbc:ID>
        <cbc:Percent>${num(l.tax_rate, 2)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${xmlEscape(inv.currency)}">${num(l.unit_price, 4)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${xmlEscape(inv.peppol_customization)}</cbc:CustomizationID>
  <cbc:ProfileID>${xmlEscape(inv.peppol_profile)}</cbc:ProfileID>
  <cbc:ID>${xmlEscape(inv.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${xmlEscape(inv.issue_date)}</cbc:IssueDate>
  ${inv.due_date ? `<cbc:DueDate>${xmlEscape(inv.due_date)}</cbc:DueDate>` : ""}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${xmlEscape(inv.currency)}</cbc:DocumentCurrencyCode>
  ${inv.po_id ? `<cac:OrderReference><cbc:ID>${xmlEscape(inv.po_id)}</cbc:ID></cac:OrderReference>` : ""}
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="${xmlEscape(supplierPart?.scheme_id || "0088")}">${xmlEscape(supplierPart?.participant_id || "")}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${xmlEscape(supplier?.name || "")}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xmlEscape(supplier?.address || "")}</cbc:StreetName>
        <cac:Country><cbc:IdentificationCode>${xmlEscape(supplier?.country_code || "US")}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity><cbc:RegistrationName>${xmlEscape(supplier?.name || "")}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="${xmlEscape(customerPart?.scheme_id || "0088")}">${xmlEscape(customerPart?.participant_id || "")}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${xmlEscape(customer?.name || "")}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xmlEscape(customer?.address || "")}</cbc:StreetName>
        <cac:Country><cbc:IdentificationCode>${xmlEscape(customer?.country_code || "US")}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity><cbc:RegistrationName>${xmlEscape(customer?.name || "")}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${xmlEscape(inv.currency)}">${num(inv.tax_total)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${xmlEscape(inv.currency)}">${num(inv.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${xmlEscape(inv.currency)}">${num(inv.subtotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${xmlEscape(inv.currency)}">${num(inv.grand_total)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${xmlEscape(inv.currency)}">${num(inv.grand_total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${linesXml}
</Invoice>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) return json({ error: "Service role key not configured" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const einvoiceId: string | undefined = body?.einvoice_id;
    if (!einvoiceId || typeof einvoiceId !== "string") {
      return json({ error: "einvoice_id required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Authorize: caller must be admin/super_admin OR supplier owner of the invoice's supplier
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    const isAdmin = roles.includes("admin") || roles.includes("super_admin");

    const { data: inv, error: invErr } = await admin
      .from("einvoices").select("*").eq("id", einvoiceId).maybeSingle();
    if (invErr || !inv) return json({ error: "Invoice not found" }, 404);

    if (!isAdmin) {
      const { data: ownerCheck } = await admin.rpc("is_supplier_owner", { _supplier_id: inv.supplier_id });
      if (!ownerCheck) return json({ error: "Forbidden" }, 403);
    }

    if (!["draft", "rejected"].includes(inv.status)) {
      return json({ error: `Cannot build UBL from status ${inv.status}` }, 409);
    }

    const { data: lines } = await admin
      .from("einvoice_lines").select("*").eq("einvoice_id", einvoiceId).order("line_no");

    const { data: supplier } = await admin
      .from("suppliers").select("id,name,address,country_code,tax_id").eq("id", inv.supplier_id).maybeSingle();
    const { data: customer } = await admin
      .from("companies").select("id,name,address").eq("id", inv.customer_company_id ?? inv.company_id).maybeSingle();

    const { data: supplierPart } = await admin
      .from("peppol_participants").select("scheme_id,participant_id")
      .eq("supplier_id", inv.supplier_id).eq("is_primary", true).maybeSingle();
    const { data: customerPart } = await admin
      .from("peppol_participants").select("scheme_id,participant_id")
      .eq("company_id", inv.customer_company_id ?? inv.company_id).eq("is_primary", true).maybeSingle();

    const issues = validateInvoice(inv, lines ?? [], supplierPart, customerPart);
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      await admin.from("einvoices").update({ validation_report: { issues } }).eq("id", einvoiceId);
      return json({ ok: false, issues }, 422);
    }

    const xml = buildUBL(inv, lines ?? [], supplier, customer, supplierPart, customerPart);
    const path = `${inv.company_id}/${inv.supplier_id}/${einvoiceId}/ubl.xml`;
    const upload = await admin.storage.from("einvoices").upload(path, new Blob([xml], { type: "application/xml" }), {
      upsert: true,
      contentType: "application/xml",
    });
    if (upload.error) return json({ error: `Storage upload failed: ${upload.error.message}` }, 500);

    const { error: updErr } = await admin.from("einvoices")
      .update({ ubl_xml_path: path, status: "validated", validation_report: { issues } })
      .eq("id", einvoiceId);
    if (updErr) return json({ error: `Update failed: ${updErr.message}` }, 500);

    await admin.from("einvoice_events").insert({
      einvoice_id: einvoiceId,
      event_type: "validated",
      actor_user_id: userData.user.id,
      payload: { ubl_xml_path: path, issue_count: issues.length },
      ip: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
    });

    return json({ ok: true, ubl_xml_path: path, issues });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("peppol-build-invoice error:", msg);
    return json({ error: msg }, 500);
  }
});
