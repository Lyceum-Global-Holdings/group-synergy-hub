// Internal: ingest an inbound PEPPOL invoice from Storecove webhook payload.
// Authenticates via service role bearer (called by peppol-webhook server-to-server).
// Downloads the UBL XML if a URL is provided, parses minimum BIS 3.0 fields, inserts
// einvoices(direction='inbound') + einvoice_lines, stores XML in storage, then triggers
// peppol-three-way-match.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.includes(SERVICE_ROLE_KEY)) {
      return new Response(JSON.stringify({ error: "Unauthorized: service-only" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event } = await req.json();
    if (!event) return jsonError("missing event", 400);

    const guid: string | undefined = event?.guid ?? event?.data?.guid;
    if (!guid) return jsonError("missing guid", 400);

    // Pull XML — Storecove sends either inline base64 or a URL we fetch with API key
    let xml: string | null = null;
    if (event?.document?.rawDocumentData?.document) {
      try { xml = atob(event.document.rawDocumentData.document); } catch { /* ignore */ }
    } else if (event?.document_url) {
      const apiKey = Deno.env.get("STORECOVE_API_KEY");
      if (apiKey) {
        const r = await fetch(event.document_url, { headers: { Authorization: `Bearer ${apiKey}` } });
        if (r.ok) xml = await r.text();
      }
    }

    if (!xml) return jsonError("inbound document XML not available", 400);

    const parsed = parseUblInvoice(xml);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Resolve supplier_id from PEPPOL participant if possible
    const supplierEndpointId: string | null = parsed.supplierEndpointId ?? null;
    const { data: matchedSupplier } = supplierEndpointId
      ? await admin.from("supplier_profiles_extended")
          .select("supplier_id")
          .eq("peppol_participant_id", supplierEndpointId)
          .maybeSingle()
          .then((r) => r as { data: { supplier_id: string } | null })
      : { data: null };

    // Resolve customer company from PEPPOL participant
    const customerEndpointId: string | null = parsed.customerEndpointId ?? null;
    const { data: matchedCompany } = customerEndpointId
      ? await admin.from("companies")
          .select("id")
          .eq("peppol_participant_id", customerEndpointId)
          .maybeSingle()
          .then((r) => r as { data: { id: string } | null })
      : { data: null };

    const xmlPath = `inbound/${guid}.xml`;
    await admin.storage.from("einvoices").upload(xmlPath, new Blob([xml], { type: "application/xml" }), {
      upsert: true, contentType: "application/xml",
    });

    const { data: inv, error: invErr } = await admin.from("einvoices").insert({
      direction: "inbound",
      status: "received",
      supplier_id: matchedSupplier?.supplier_id ?? null,
      customer_company_id: matchedCompany?.id ?? null,
      company_id: matchedCompany?.id ?? null,
      invoice_number: parsed.invoiceNumber,
      issue_date: parsed.issueDate,
      due_date: parsed.dueDate,
      currency: parsed.currency ?? "USD",
      subtotal: parsed.subtotal ?? 0,
      tax_total: parsed.taxTotal ?? 0,
      grand_total: parsed.grandTotal ?? 0,
      peppol_message_id: guid,
      peppol_profile: parsed.profileId,
      peppol_customization: parsed.customizationId,
      ubl_xml_path: xmlPath,
      validation_report: { source: "storecove_inbound", lines: parsed.lines.length },
      notes: parsed.note,
    }).select("id, supplier_id").single();

    if (invErr || !inv) return jsonError(`insert einvoice failed: ${invErr?.message}`, 500);

    if (parsed.lines.length > 0) {
      await admin.from("einvoice_lines").insert(parsed.lines.map((l, i) => ({
        einvoice_id: inv.id,
        line_no: l.lineNo ?? i + 1,
        item_code: l.itemCode,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unitPrice,
        line_extension: l.lineExtension,
        tax_category: l.taxCategory,
        tax_rate: l.taxRate,
        tax_amount: l.taxAmount,
      })));
    }

    await admin.from("einvoice_events").insert({
      einvoice_id: inv.id,
      event_type: "created",
      payload: { source: "peppol_inbound", provider_message_id: guid },
    });

    // Fire-and-forget 3-way match
    fetch(`${SUPABASE_URL}/functions/v1/peppol-three-way-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ einvoice_id: inv.id }),
    }).catch((e) => console.warn("three-way-match dispatch failed", e));

    return new Response(JSON.stringify({ ok: true, einvoice_id: inv.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("peppol-ingest-inbound error", message);
    return jsonError(message, 500);
  }
});

function jsonError(error: unknown, status: number) {
  return new Response(JSON.stringify({ error }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Minimal UBL 2.1 / PEPPOL BIS 3.0 invoice parser (regex/walker; sufficient for header + lines).
function parseUblInvoice(xml: string) {
  const tag = (name: string, src = xml) =>
    new RegExp(`<(?:[A-Za-z0-9]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9]+:)?${name}>`).exec(src)?.[1]?.trim();
  const all = (name: string, src = xml) => {
    const re = new RegExp(`<(?:[A-Za-z0-9]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9]+:)?${name}>`, "g");
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) out.push(m[1]);
    return out;
  };
  const num = (s: string | undefined) => (s == null ? null : Number(s));

  const supplierBlock = tag("AccountingSupplierParty");
  const customerBlock = tag("AccountingCustomerParty");
  const supplierEndpointId = supplierBlock ? tag("EndpointID", supplierBlock) ?? null : null;
  const customerEndpointId = customerBlock ? tag("EndpointID", customerBlock) ?? null : null;

  const lines = all("InvoiceLine").map((src) => ({
    lineNo: num(tag("ID", src)),
    itemCode: tag("ID", tag("Item", src) ?? "") ?? null,
    description: tag("Name", tag("Item", src) ?? "") ?? tag("Description", src) ?? null,
    quantity: num(tag("InvoicedQuantity", src)) ?? 0,
    unit: /unitCode="([^"]+)"/.exec(src)?.[1] ?? null,
    unitPrice: num(tag("PriceAmount", src)) ?? 0,
    lineExtension: num(tag("LineExtensionAmount", src)) ?? 0,
    taxCategory: tag("ID", tag("ClassifiedTaxCategory", src) ?? "") ?? null,
    taxRate: num(tag("Percent", tag("ClassifiedTaxCategory", src) ?? "")),
    taxAmount: num(tag("TaxAmount", src)),
  }));

  const monetary = tag("LegalMonetaryTotal") ?? "";
  return {
    profileId: tag("ProfileID") ?? null,
    customizationId: tag("CustomizationID") ?? null,
    invoiceNumber: tag("ID") ?? null,
    issueDate: tag("IssueDate") ?? null,
    dueDate: tag("DueDate") ?? null,
    currency: tag("DocumentCurrencyCode") ?? null,
    note: tag("Note") ?? null,
    subtotal: num(tag("LineExtensionAmount", monetary)) ?? null,
    taxTotal: num(tag("TaxAmount")) ?? null,
    grandTotal: num(tag("PayableAmount", monetary)) ?? null,
    supplierEndpointId,
    customerEndpointId,
    lines,
  };
}
