// Internal: ingest an inbound PEPPOL invoice or credit note from a Storecove
// webhook payload. Authenticates via service role bearer (called by
// peppol-webhook server-to-server). Stores the UBL XML, then hands the parsed
// document to record_inbound_einvoice, which routes it to our company and the
// supplier by their PEPPOL IDs, links the PO from the order reference and puts
// it in accounts payable. Finally runs the three-way match, whose result
// follows the invoice into payables.
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

    const parsed = parseUbl(xml);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const xmlPath = `inbound/${guid}.xml`;
    await admin.storage.from("einvoices").upload(xmlPath, new Blob([xml], { type: "application/xml" }), {
      upsert: true, contentType: "application/xml",
    });

    const { data: einvoiceId, error: recErr } = await admin.rpc("record_inbound_einvoice", {
      p_doc: { ...parsed, message_id: guid, xml_path: xmlPath },
    });
    if (recErr || !einvoiceId) {
      // Typically an unregistered PEPPOL ID: register it under the company, then replay.
      console.error("peppol-ingest-inbound: not recorded", guid, recErr?.message);
      return jsonError(recErr?.message ?? "not recorded", 422);
    }

    // Match against the PO and GRN; the result is copied onto the payables invoice.
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/peppol-three-way-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ einvoice_id: einvoiceId }),
      });
      if (!r.ok) console.warn("three-way-match returned", r.status, await r.text());
    } catch (e) {
      console.warn("three-way-match dispatch failed", e);
    }

    return new Response(JSON.stringify({ ok: true, einvoice_id: einvoiceId }), {
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

// Minimal UBL 2.1 / PEPPOL BIS 3.0 parser for invoices and credit notes
// (regex walker; enough for the header, parties, references and lines).
export function parseUbl(xml: string) {
  const re = (name: string, flags = "") =>
    new RegExp(`<(?:[A-Za-z0-9]+:)?${name}(\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9]+:)?${name}>`, flags);
  // `src` is required on purpose: a missing parent section must give nothing,
  // not a match from elsewhere in the document.
  const tag = (name: string, src: string | undefined) => (src ? re(name).exec(src)?.[2]?.trim() : undefined);
  const attr = (name: string, attribute: string, src: string | undefined) =>
    src ? new RegExp(`${attribute}="([^"]+)"`).exec(re(name).exec(src)?.[1] ?? "")?.[1] : undefined;
  const all = (name: string, src: string) => [...src.matchAll(re(name, "g"))].map((m) => m[2]);
  const num = (s: string | undefined) => (s == null || s === "" ? null : Number(s));
  const text = (s: string | undefined) => (s ? s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : null);

  const isCreditNote = /<(?:[A-Za-z0-9]+:)?CreditNote[\s>]/.test(xml);
  const party = (block: string | undefined) => ({
    endpoint_id: text(tag("EndpointID", block)),
    endpoint_scheme: attr("EndpointID", "schemeID", block) ?? null,
    name: text(tag("Name", tag("PartyName", block))) ?? text(tag("RegistrationName", block)),
    tax_id: text(tag("CompanyID", tag("PartyTaxScheme", block))) ?? text(tag("CompanyID", tag("PartyLegalEntity", block))),
  });

  const lines = all(isCreditNote ? "CreditNoteLine" : "InvoiceLine", xml).map((src, i) => {
    const item = tag("Item", src);
    const taxCat = tag("ClassifiedTaxCategory", item);
    const lineExtension = num(tag("LineExtensionAmount", src)) ?? 0;
    const taxRate = num(tag("Percent", taxCat)) ?? 0;
    return {
      line_no: num(tag("ID", src)) ?? i + 1,
      item_code: text(tag("ID", tag("SellersItemIdentification", item))) ?? text(tag("ID", tag("BuyersItemIdentification", item))),
      description: text(tag("Name", item)) ?? text(tag("Description", item)) ?? text(tag("Note", src)),
      quantity: num(tag(isCreditNote ? "CreditedQuantity" : "InvoicedQuantity", src)) ?? 0,
      unit: attr(isCreditNote ? "CreditedQuantity" : "InvoicedQuantity", "unitCode", src) ?? null,
      unit_price: num(tag("PriceAmount", tag("Price", src))) ?? 0,
      line_extension: lineExtension,
      tax_category: text(tag("ID", taxCat)),
      tax_rate: taxRate,
      tax_amount: num(tag("TaxAmount", src)) ?? Math.round(lineExtension * taxRate) / 100,
    };
  });

  const monetary = tag("LegalMonetaryTotal", xml);
  return {
    document_type: isCreditNote ? "credit_note" : "invoice",
    profile_id: text(tag("ProfileID", xml)),
    customization_id: text(tag("CustomizationID", xml)),
    invoice_number: text(tag("ID", xml)),
    issue_date: text(tag("IssueDate", xml)),
    due_date: text(tag("DueDate", xml)) ?? text(tag("PaymentDueDate", xml)),
    currency: text(tag("DocumentCurrencyCode", xml)),
    note: text(tag("Note", xml)),
    order_reference: text(tag("ID", tag("OrderReference", xml))),
    buyer_reference: text(tag("BuyerReference", xml)),
    subtotal: num(tag("LineExtensionAmount", monetary)) ?? num(tag("TaxExclusiveAmount", monetary)),
    tax_total: num(tag("TaxAmount", tag("TaxTotal", xml))),
    grand_total: num(tag("PayableAmount", monetary)) ?? num(tag("TaxInclusiveAmount", monetary)),
    seller: party(tag("AccountingSupplierParty", xml)),
    buyer: party(tag("AccountingCustomerParty", xml)),
    lines,
  };
}
