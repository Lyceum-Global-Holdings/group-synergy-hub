// PEPPOL Phase 4 — Issue a credit note from a posted invoice.
// Clones the source invoice + lines with negated amounts, sets document_type='credit_note',
// links via corrected_einvoice_id, status='draft', appends 'credit_note_issued' event.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.23.8";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const Body = z.object({
  einvoice_id: z.string().uuid(),
  reason: z.string().min(1).max(500),
  invoice_number: z.string().min(1).max(64).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const URL_ = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await userClient.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) return json({ error: "Forbidden: admin only" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const { einvoice_id, reason, invoice_number } = parsed.data;

    const admin = createClient(URL_, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: src, error: e1 } = await admin
      .from("einvoices").select("*").eq("id", einvoice_id).maybeSingle();
    if (e1 || !src) return json({ error: "Source invoice not found" }, 404);
    if (src.document_type === "credit_note")
      return json({ error: "Cannot issue a credit note for a credit note" }, 400);
    if (!["sent", "delivered", "posted", "matched"].includes(src.status))
      return json({ error: `Source invoice not eligible (status=${src.status})` }, 400);

    const { data: srcLines } = await admin
      .from("einvoice_lines").select("*").eq("einvoice_id", einvoice_id).order("line_no");

    const newNumber = invoice_number ?? `CN-${src.invoice_number}-${Date.now().toString(36).toUpperCase()}`;

    const insertRow = {
      company_id: src.company_id,
      supplier_id: src.supplier_id,
      customer_company_id: src.customer_company_id,
      direction: src.direction,
      document_type: "credit_note",
      compliance_profile: src.compliance_profile,
      corrected_einvoice_id: src.id,
      invoice_number: newNumber,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: null,
      currency: src.currency,
      subtotal: -Number(src.subtotal ?? 0),
      tax_total: -Number(src.tax_total ?? 0),
      grand_total: -Number(src.grand_total ?? 0),
      status: "draft",
      peppol_profile: src.peppol_profile,
      peppol_customization: src.peppol_customization,
      po_id: src.po_id,
      created_by: user.id,
    };

    const { data: ins, error: e2 } = await admin.from("einvoices").insert(insertRow).select("id").single();
    if (e2 || !ins) return json({ error: `Insert failed: ${e2?.message}` }, 500);

    if (srcLines && srcLines.length > 0) {
      const newLines = srcLines.map((l: any) => ({
        einvoice_id: ins.id,
        line_no: l.line_no,
        item_code: l.item_code,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unit_price,
        line_extension: -Number(l.line_extension ?? 0),
        tax_rate: l.tax_rate,
        tax_amount: -Number(l.tax_amount ?? 0),
        tax_category: l.tax_category,
      }));
      const { error: e3 } = await admin.from("einvoice_lines").insert(newLines);
      if (e3) return json({ error: `Lines insert failed: ${e3.message}` }, 500);
    }

    await admin.rpc("log_einvoice_event", {
      p_einvoice_id: ins.id,
      p_event_type: "credit_note_issued",
      p_payload: { source_einvoice_id: src.id, reason },
      p_ip: req.headers.get("x-forwarded-for"),
      p_user_agent: req.headers.get("user-agent"),
    });

    return json({ ok: true, credit_note_id: ins.id, invoice_number: newNumber });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("peppol-credit-note error:", m);
    return json({ error: m }, 500);
  }
});
