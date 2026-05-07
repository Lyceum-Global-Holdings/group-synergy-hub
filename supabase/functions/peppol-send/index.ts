// Submit a validated e-invoice (UBL XML) to Storecove.
// Admin-only. Reads the UBL from the einvoices storage bucket, posts to Storecove,
// records einvoice_transmissions, transitions einvoices.status, and appends an event.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  einvoice_id: z.string().uuid(),
  recipient_peppol_id: z.string().min(3).max(100).optional(),
});

const STORECOVE_BASE = Deno.env.get("STORECOVE_BASE_URL") ?? "https://api.storecove.com/api/v2";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Unauthorized", 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const STORECOVE_API_KEY = Deno.env.get("STORECOVE_API_KEY");
    const STORECOVE_LEGAL_ENTITY_ID = Deno.env.get("STORECOVE_SENDER_LEGAL_ENTITY_ID");

    const supaUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !user) return jsonError("Unauthorized", 401);

    const { data: isAdmin } = await supaUser.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) return jsonError("Forbidden: admin only", 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(parsed.error.flatten(), 400);
    const { einvoice_id, recipient_peppol_id } = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: inv, error: invErr } = await admin
      .from("einvoices")
      .select("id, status, direction, ubl_xml_path, supplier_id, company_id, invoice_number")
      .eq("id", einvoice_id)
      .maybeSingle();
    if (invErr || !inv) return jsonError("E-invoice not found", 404);

    if (inv.direction !== "outbound") return jsonError("Only outbound invoices can be sent", 400);
    if (!["validated", "ready_to_send", "submission_failed"].includes(inv.status)) {
      return jsonError(`Invoice not in a sendable status (current: ${inv.status})`, 400);
    }
    if (!inv.ubl_xml_path) return jsonError("UBL XML not built yet", 400);

    if (!STORECOVE_API_KEY || !STORECOVE_LEGAL_ENTITY_ID) {
      return jsonError(
        "Storecove not configured. Add STORECOVE_API_KEY and STORECOVE_SENDER_LEGAL_ENTITY_ID secrets.",
        503,
      );
    }

    // Download UBL
    const { data: file, error: dlErr } = await admin.storage.from("einvoices").download(inv.ubl_xml_path);
    if (dlErr || !file) return jsonError(`Failed to load UBL: ${dlErr?.message ?? "no file"}`, 500);
    const xmlText = await file.text();
    const xmlB64 = btoa(unescape(encodeURIComponent(xmlText)));

    // Build Storecove submission (sandbox-friendly minimal envelope)
    const submission = {
      legalEntityId: Number(STORECOVE_LEGAL_ENTITY_ID),
      receiverIdentifier: recipient_peppol_id
        ? { scheme: recipient_peppol_id.split(":")[0] ?? "iso6523-actorid-upis", id: recipient_peppol_id }
        : undefined,
      document: {
        documentType: "invoice",
        rawDocumentData: { document: xmlB64, parse: true, parseStrategy: "ubl" },
      },
    };

    const resp = await fetch(`${STORECOVE_BASE}/document_submissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STORECOVE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submission),
    });
    const respBody = await resp.json().catch(() => ({}));
    const ok = resp.ok;

    const providerMessageId = (respBody?.guid ?? respBody?.id ?? null) as string | null;

    // Record transmission
    await admin.from("einvoice_transmissions").insert({
      einvoice_id,
      provider: "storecove",
      direction: "outbound",
      provider_message_id: providerMessageId,
      last_status: ok ? "submitted" : "failed",
      last_status_at: new Date().toISOString(),
      attempt_count: 1,
      error_message: ok ? null : (respBody?.error ?? `HTTP ${resp.status}`),
      raw_response: respBody,
      created_by: user.id,
    });

    // Update einvoice status + event
    const newStatus = ok ? "sent" : "submission_failed";
    await admin.from("einvoices").update({
      status: newStatus,
      peppol_message_id: providerMessageId ?? undefined,
    }).eq("id", einvoice_id);

    await admin.from("einvoice_events").insert({
      einvoice_id,
      event_type: ok ? "submitted" : "rejected",
      actor_user_id: user.id,
      payload: { provider: "storecove", provider_message_id: providerMessageId, http_status: resp.status },
    });

    if (!ok) {
      return jsonError(
        { storecove_error: respBody, http_status: resp.status, message: "Storecove rejected the submission" },
        502,
      );
    }

    return new Response(
      JSON.stringify({ success: true, provider_message_id: providerMessageId, status: newStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("peppol-send error", message);
    return jsonError(message, 500);
  }
});

function jsonError(error: unknown, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
