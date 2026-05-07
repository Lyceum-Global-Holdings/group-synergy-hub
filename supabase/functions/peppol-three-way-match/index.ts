// 3-way match: link an inbound einvoice to its PO and GRN, compute discrepancies.
// Tolerances: qty ±5%, price ±2%, total ±1 unit currency.
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
      .select("id, po_id, grn_id, supplier_id, grand_total, currency, notes, invoice_number")
      .eq("id", einvoice_id)
      .maybeSingle();
    if (!inv) return jsonError("E-invoice not found", 404);

    const { data: lines } = await admin
      .from("einvoice_lines")
      .select("id, line_no, item_code, description, quantity, unit_price, line_extension")
      .eq("einvoice_id", einvoice_id);

    // Resolve PO if not already linked: try invoice_number, then notes (BuyerReference), then supplier
    let poId = inv.po_id;
    if (!poId && inv.invoice_number) {
      const { data: poByRef } = await admin
        .from("purchase_orders")
        .select("id")
        .eq("supplier_id", inv.supplier_id)
        .or(`po_number.eq.${inv.invoice_number},external_reference.eq.${inv.invoice_number}`)
        .limit(1)
        .maybeSingle();
      if (poByRef) poId = poByRef.id;
    }

    let grnId = inv.grn_id;
    if (!grnId && poId) {
      const { data: grn } = await admin
        .from("goods_receipt_notes")
        .select("id")
        .eq("po_id", poId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (grn) grnId = grn.id;
    }

    // Pull PO lines and GRN lines if available
    const { data: poLines } = poId
      ? await admin.from("purchase_order_items").select("id, item_id, item_code, quantity, unit_price").eq("po_id", poId)
      : { data: [] as any[] };

    const { data: grnLines } = grnId
      ? await admin.from("grn_items").select("id, po_item_id, received_quantity").eq("grn_id", grnId)
      : { data: [] as any[] };

    const discrepancies: any[] = [];
    let qtyOk = true;
    let priceOk = true;

    for (const il of lines ?? []) {
      const pl = (poLines ?? []).find((p: any) => p.item_code && il.item_code && p.item_code === il.item_code);
      if (!pl) {
        discrepancies.push({ line_no: il.line_no, code: "no_po_line", item_code: il.item_code });
        qtyOk = false; priceOk = false;
        continue;
      }
      const recv = (grnLines ?? []).find((g: any) => g.po_item_id === pl.id)?.received_quantity ?? pl.quantity;
      const qtyDelta = Math.abs(Number(il.quantity) - Number(recv)) / Math.max(Number(recv) || 1, 1);
      const priceDelta = Math.abs(Number(il.unit_price) - Number(pl.unit_price)) / Math.max(Number(pl.unit_price) || 1, 1);
      if (qtyDelta > QTY_TOL) {
        qtyOk = false;
        discrepancies.push({ line_no: il.line_no, code: "qty", invoiced: il.quantity, received: recv, delta_pct: qtyDelta });
      }
      if (priceDelta > PRICE_TOL) {
        priceOk = false;
        discrepancies.push({ line_no: il.line_no, code: "price", invoiced: il.unit_price, po: pl.unit_price, delta_pct: priceDelta });
      }
    }

    const poTotal = (poLines ?? []).reduce((s: number, p: any) => s + Number(p.quantity) * Number(p.unit_price), 0);
    const totalOk = Math.abs(Number(inv.grand_total ?? 0) - poTotal) <= TOTAL_TOL;
    if (!totalOk && poTotal > 0) {
      discrepancies.push({ code: "total", invoiced: inv.grand_total, po_total: poTotal });
    }

    const allMatched = qtyOk && priceOk && totalOk && (lines?.length ?? 0) > 0;
    const matchStatus = !poId
      ? "unmatched"
      : allMatched
        ? "matched"
        : discrepancies.length > 0 ? "discrepancy" : "partial";

    const score = computeScore({ qtyOk, priceOk, totalOk, hasPo: !!poId, hasGrn: !!grnId });

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
