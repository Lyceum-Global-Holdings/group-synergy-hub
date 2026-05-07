// PEPPOL Phase 4 — DSAR / Compliance export.
// Admin-only. Returns a JSON bundle with all e-invoice records related to a counterparty
// (supplier_id or customer_company_id) for a given company. The caller can persist this
// to a ZIP/PDF downstream; this function focuses on aggregation + audit.
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
  company_id: z.string().uuid(),
  supplier_id: z.string().uuid().optional(),
  customer_company_id: z.string().uuid().optional(),
}).refine((v) => v.supplier_id || v.customer_company_id, {
  message: "Provide supplier_id or customer_company_id",
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
    const { company_id, supplier_id, customer_company_id } = parsed.data;

    const admin = createClient(URL_, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

    let q = admin.from("einvoices").select("*").eq("company_id", company_id);
    if (supplier_id) q = q.eq("supplier_id", supplier_id);
    if (customer_company_id) q = q.eq("customer_company_id", customer_company_id);
    const { data: invoices, error: e1 } = await q;
    if (e1) return json({ error: e1.message }, 500);

    const ids = (invoices ?? []).map((i: any) => i.id);
    const fetchByInvoiceId = async (table: string) => {
      if (ids.length === 0) return [];
      const { data } = await admin.from(table).select("*").in("einvoice_id", ids);
      return data ?? [];
    };

    const [lines, events, transmissions, matches, artifacts] = await Promise.all([
      fetchByInvoiceId("einvoice_lines"),
      fetchByInvoiceId("einvoice_events"),
      fetchByInvoiceId("einvoice_transmissions"),
      fetchByInvoiceId("einvoice_match_results"),
      fetchByInvoiceId("einvoice_country_artifacts"),
    ]);

    // Audit log on each affected invoice
    for (const id of ids) {
      await admin.rpc("log_einvoice_event", {
        p_einvoice_id: id,
        p_event_type: "dsar_exported",
        p_payload: { requested_by: user.id, supplier_id, customer_company_id },
        p_ip: req.headers.get("x-forwarded-for"),
        p_user_agent: req.headers.get("user-agent"),
      });
    }

    return json({
      ok: true,
      generated_at: new Date().toISOString(),
      generated_by: user.id,
      scope: { company_id, supplier_id, customer_company_id },
      counts: {
        invoices: invoices?.length ?? 0,
        lines: lines.length,
        events: events.length,
        transmissions: transmissions.length,
        matches: matches.length,
        country_artifacts: artifacts.length,
      },
      data: { invoices, lines, events, transmissions, matches, country_artifacts: artifacts },
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("peppol-dsar-export error:", m);
    return json({ error: m }, 500);
  }
});
