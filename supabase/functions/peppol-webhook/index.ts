// Public webhook receiver for Storecove PEPPOL events.
// Verifies HMAC-SHA256 signature against STORECOVE_WEBHOOK_SECRET, then routes
// the event to update einvoice_transmissions, einvoices.status, and einvoice_events.
// For received invoices, it triggers peppol-ingest-inbound.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-storecove-signature",
};

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEq(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SECRET = Deno.env.get("STORECOVE_WEBHOOK_SECRET");

    const raw = await req.text();
    const headerSig = req.headers.get("x-storecove-signature");

    if (SECRET) {
      const expected = await hmacSha256Hex(SECRET, raw);
      if (!safeEq(headerSig, expected)) {
        console.warn("peppol-webhook: bad signature");
        return new Response(JSON.stringify({ error: "invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("peppol-webhook: STORECOVE_WEBHOOK_SECRET not set; accepting unsigned payload (dev only)");
    }

    let event: any;
    try { event = JSON.parse(raw); } catch {
      return new Response(JSON.stringify({ error: "invalid json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const eventType: string = event?.event ?? event?.type ?? "unknown";
    const guid: string | undefined = event?.guid ?? event?.message_id ?? event?.data?.guid;

    // Outbound status events: invoice.delivered, invoice.failed, invoice.mlr, invoice.blr
    if (eventType.startsWith("invoice.") && guid) {
      const { data: tx } = await admin
        .from("einvoice_transmissions")
        .select("id, einvoice_id")
        .eq("provider", "storecove")
        .eq("provider_message_id", guid)
        .maybeSingle();

      if (tx) {
        const lastStatus = mapEventToTransmissionStatus(eventType);
        await admin.from("einvoice_transmissions")
          .update({
            last_status: lastStatus,
            last_status_at: new Date().toISOString(),
            raw_response: event,
          })
          .eq("id", tx.id);

        const nextInvoiceStatus = mapEventToInvoiceStatus(eventType);
        if (nextInvoiceStatus) {
          await admin.from("einvoices")
            .update({ status: nextInvoiceStatus })
            .eq("id", tx.einvoice_id);
        }

        await admin.from("einvoice_events").insert({
          einvoice_id: tx.einvoice_id,
          event_type: mapEventToEventType(eventType),
          payload: event,
        });
      } else if (eventType === "invoice.received") {
        // Inbound: ingest a brand-new invoice
        const ingestUrl = `${SUPABASE_URL}/functions/v1/peppol-ingest-inbound`;
        await fetch(ingestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ event }),
        }).catch((e) => console.error("ingest dispatch failed", e));
      } else {
        console.warn("peppol-webhook: no transmission match for guid", guid);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("peppol-webhook error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapEventToTransmissionStatus(t: string): string {
  switch (t) {
    case "invoice.delivered": return "delivered";
    case "invoice.failed": return "failed";
    case "invoice.mlr": return "mlr_received";
    case "invoice.blr": return "blr_received";
    case "invoice.received": return "received";
    default: return t;
  }
}
function mapEventToInvoiceStatus(t: string): string | null {
  switch (t) {
    case "invoice.delivered": return "delivered";
    case "invoice.failed": return "rejected";
    case "invoice.blr": return "accepted";
    default: return null;
  }
}
function mapEventToEventType(t: string): string {
  switch (t) {
    case "invoice.delivered": return "ack_received";
    case "invoice.failed": return "rejected";
    case "invoice.mlr":
    case "invoice.blr": return "ack_received";
    case "invoice.received": return "created";
    default: return "updated";
  }
}
