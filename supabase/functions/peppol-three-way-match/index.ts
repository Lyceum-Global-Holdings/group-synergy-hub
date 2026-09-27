// 3-way match: link an inbound einvoice to its PO and GRN, compute discrepancies.
// Quantities are compared with what approved receipts accepted for each PO line,
// prices with the PO, and the net total with received quantity × PO price.
// Tolerances: qty ±5%, price ±2%, total ±2% (at least 1 unit of currency).
// The match status is copied onto the payables invoice by a database trigger.
// Callable by admins (with JWT) or by service-role (internal pipeline).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const QTY_TOL = 0.05;
const PRICE_TOL = 0.02;
const TOTAL_TOL = 1.0;

const BodySchema = z.object({ einvoice_id: z.string().uuid() });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const isService = authHeader.includes(SERVICE_ROLE_KEY);
    let actorId: string | null = null;

    if (!isService) {
      if (!authHeader) return jsonError("Unauthorized", 401);
      const supaUser = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supaUser.auth.getUser();
      if (!user) return jsonError("Unauthorized", 401);
      const { data: isAdmin } = await supaUser.rpc("is_admin", { _user_id: user.id });
      if (!isAdmin) return jsonError("Forbidden", 403);
      actorId = user.id;
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(parsed.error.flatten(), 400);
    const { einvoice_id } = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: inv } = await admin
      .from("einvoices")
      .select("id, company_id, po_id, grn_id, supplier_id, subtotal, grand_total, currency, notes, invoice_number, document_type, validation_report")
      .eq("id", einvoice_id)
      .maybeSingle();
    if (!inv) return jsonError("E-invoice not found", 404);
    if (inv.document_type === "credit_note") {
      return new Response(JSON.stringify({ ok: true, skipped: "credit notes are not three-way matched" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lines } = await admin
      .from("einvoice_lines")
      .select("id, line_no, item_code, description, quantity, unit_price, line_extension, po_line_id")
      .eq("einvoice_id", einvoice_id);

    // Resolve the PO if it isn't linked yet, from the invoice's order reference
    // (or buyer reference) within the same company and supplier.
    let poId = inv.po_id;
    const report = (inv.validation_report ?? {}) as Record<string, unknown>;
    for (const ref of [report.order_reference, report.buyer_reference]) {
      if (poId || typeof ref !== "string" || !ref.trim()) continue;
      let q = admin.from("purchase_orders").select("id").eq("company_id", inv.company_id).eq("po_number", ref.trim());
      if (inv.supplier_id) q = q.eq("supplier_id", inv.supplier_id);
      const { data: po } = await q.limit(1).maybeSingle();
      if (po) poId = po.id;
    }

    // Goods received and accepted against the PO (approved receipts only).
    const { data: grns } = poId
      ? await admin.from("goods_receipt_notes").select("id, approved_date, created_at")
          .eq("po_id", poId).in("status", ["approved", "completed"])
          .order("approved_date", { ascending: false, nullsFirst: false })
      : { data: [] as any[] };
    const grnId = inv.grn_id ?? grns?.[0]?.id ?? null;

    const { data: poLines } = poId
      ? await admin.from("po_items")
          .select("id, item_code, warehouse_item_id, quantity_ordered, unit_price")
          .eq("po_id", poId)
      : { data: [] as any[] };

    const { data: grnLines } = (grns?.length ?? 0) > 0
      ? await admin.from("grn_items").select("po_item_id, quantity_received, quantity_accepted").in("grn_id", grns!.map((g: any) => g.id))
      : { data: [] as any[] };
    const acceptedFor = (poLineId: string) =>
      (grnLines ?? []).filter((g: any) => g.po_item_id === poLineId)
        .reduce((s: number, g: any) => s + Number(g.quantity_accepted ?? g.quantity_received ?? 0), 0);

    const discrepancies: any[] = [];
    let qtyOk = true;
    let priceOk = true;
    let expectedValue = 0;

    for (const il of lines ?? []) {
      const pl = (poLines ?? []).find((p: any) => p.id === il.po_line_id)
        ?? (poLines ?? []).find((p: any) => p.item_code && il.item_code && p.item_code.toLowerCase() === String(il.item_code).toLowerCase());
      if (!pl) {
        discrepancies.push({ line_no: il.line_no, code: "no_po_line", item_code: il.item_code });
        qtyOk = false; priceOk = false;
        continue;
      }
      // Without any approved receipt this is a two-way match against the order.
      const recv = (grns?.length ?? 0) > 0 ? acceptedFor(pl.id) : Number(pl.quantity_ordered);
      const qtyDelta = Math.abs(Number(il.quantity) - recv) / Math.max(recv || 1, 1);
      const priceDelta = Math.abs(Number(il.unit_price) - Number(pl.unit_price)) / Math.max(Number(pl.unit_price) || 1, 1);
      if (qtyDelta > QTY_TOL) {
        qtyOk = false;
        discrepancies.push({ line_no: il.line_no, code: "qty", invoiced: il.quantity, received: recv, delta_pct: qtyDelta });
      }
      if (priceDelta > PRICE_TOL) {
        priceOk = false;
        discrepancies.push({ line_no: il.line_no, code: "price", invoiced: il.unit_price, po: pl.unit_price, delta_pct: priceDelta });
      }
      expectedValue += recv * Number(pl.unit_price);
    }

    // Net invoice value against what was received at the ordered price.
    const invoiceNet = Number(inv.subtotal ?? 0);
    const totalOk = Math.abs(invoiceNet - expectedValue) <= Math.max(TOTAL_TOL, expectedValue * PRICE_TOL);
    if (!totalOk && expectedValue > 0) {
      discrepancies.push({ code: "total", invoiced: invoiceNet, expected: expectedValue });
    }

    const allMatched = qtyOk && priceOk && totalOk && (lines?.length ?? 0) > 0;
    const matchStatus = !poId
      ? "unmatched"
      : allMatched
        ? "matched"
        : discrepancies.length > 0 ? "discrepancy" : "partial";

    const score = computeScore({ qtyOk, priceOk, totalOk, hasPo: !!poId, hasGrn: (grns?.length ?? 0) > 0 });

    await admin.from("einvoice_match_results").insert({
      einvoice_id,
      po_id: poId,
      grn_id: grnId,
      qty_match: qtyOk,
      price_match: priceOk,
      total_match: totalOk,
      score,
      discrepancies,
      evaluated_by: actorId,
    });

    await admin.from("einvoices")
      .update({ match_status: matchStatus, po_id: poId, grn_id: grnId })
      .eq("id", einvoice_id);

    await admin.from("einvoice_events").insert({
      einvoice_id,
      event_type: "matched",
      actor_user_id: actorId,
      payload: { match_status: matchStatus, score, po_id: poId, grn_id: grnId, discrepancy_count: discrepancies.length },
    });

    return new Response(
      JSON.stringify({ ok: true, match_status: matchStatus, score, discrepancies, po_id: poId, grn_id: grnId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("peppol-three-way-match error", message);
    return jsonError(message, 500);
  }
});

function jsonError(error: unknown, status: number) {
  return new Response(JSON.stringify({ error }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function computeScore(s: { qtyOk: boolean; priceOk: boolean; totalOk: boolean; hasPo: boolean; hasGrn: boolean }) {
  let score = 0;
  if (s.hasPo) score += 25;
  if (s.hasGrn) score += 15;
  if (s.qtyOk) score += 25;
  if (s.priceOk) score += 25;
  if (s.totalOk) score += 10;
  return score;
}
