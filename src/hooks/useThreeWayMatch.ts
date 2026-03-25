import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type MatchStatus = "pending" | "matched" | "exception" | "failed";

export interface MatchLineItem {
  itemName: string;
  itemCode: string | null;
  poQty: number;
  poUnitPrice: number;
  grnQty: number | null;
  grnUnitPrice: number | null;
  invoiceQty: number | null;
  invoiceUnitPrice: number | null;
  qtyVariance: number | null;
  priceVariance: number | null;
  qtyMatch: "match" | "tolerance" | "mismatch" | "missing";
  priceMatch: "match" | "tolerance" | "mismatch" | "missing";
}

export interface MatchResult {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  poId: string;
  poNumber: string;
  grnId: string | null;
  grnNumber: string | null;
  supplierName: string;
  poAmount: number;
  grnAmount: number | null;
  invoiceAmount: number;
  variancePercent: number;
  status: MatchStatus;
  lineItems: MatchLineItem[];
}

interface MatchConfig {
  priceTolerance: number; // percentage, e.g. 2 = 2%
  qtyTolerance: number;   // absolute units, e.g. 0
}

const DEFAULT_CONFIG: MatchConfig = { priceTolerance: 2, qtyTolerance: 0 };

function classifyVariance(
  expected: number,
  actual: number | null,
  tolerancePercent: number,
  isQty: boolean,
  qtyTolerance: number
): "match" | "tolerance" | "mismatch" | "missing" {
  if (actual === null || actual === undefined) return "missing";
  if (expected === actual) return "match";
  if (isQty) {
    const diff = Math.abs(expected - actual);
    return diff <= qtyTolerance ? "match" : "mismatch";
  }
  const pct = expected === 0 ? 100 : (Math.abs(expected - actual) / expected) * 100;
  if (pct <= tolerancePercent) return "tolerance";
  return "mismatch";
}

function computeMatchResult(
  invoice: any,
  po: any,
  grn: any | null,
  poItems: any[],
  grnItems: any[],
  invoiceLines: any[],
  config: MatchConfig
): MatchResult {
  const lineItems: MatchLineItem[] = poItems.map((poItem) => {
    const grnItem = grnItems.find(
      (g) => g.po_item_id === poItem.id || g.item_code === poItem.item_code
    );
    const invLine = invoiceLines.find(
      (l) => (l.description || "").toLowerCase() === (poItem.item_name || "").toLowerCase()
        || l.line_number === poItems.indexOf(poItem) + 1
    );

    const grnQty = grnItem?.quantity_received ?? null;
    const grnPrice = grnItem?.unit_price ?? null;
    const invQty = invLine?.quantity ?? null;
    const invPrice = invLine?.unit_price ?? null;

    return {
      itemName: poItem.item_name,
      itemCode: poItem.item_code,
      poQty: poItem.quantity_ordered,
      poUnitPrice: poItem.unit_price,
      grnQty,
      grnUnitPrice: grnPrice,
      invoiceQty: invQty,
      invoiceUnitPrice: invPrice,
      qtyVariance: invQty !== null ? invQty - poItem.quantity_ordered : null,
      priceVariance: invPrice !== null ? invPrice - poItem.unit_price : null,
      qtyMatch: classifyVariance(poItem.quantity_ordered, invQty, 0, true, config.qtyTolerance),
      priceMatch: classifyVariance(poItem.unit_price, invPrice, config.priceTolerance, false, 0),
    };
  });

  const hasAnyMissing = lineItems.some(l => l.qtyMatch === "missing" || l.priceMatch === "missing");
  const hasAnyMismatch = lineItems.some(l => l.qtyMatch === "mismatch" || l.priceMatch === "mismatch");
  const hasAnyTolerance = lineItems.some(l => l.priceMatch === "tolerance");

  let status: MatchStatus = "matched";
  if (!grn || hasAnyMissing) status = "pending";
  else if (hasAnyMismatch) status = "exception";
  else if (hasAnyTolerance) status = "matched";

  const poAmount = po?.total_amount ?? poItems.reduce((s, i) => s + i.total_price, 0);
  const grnAmount = grn?.total_value ?? null;
  const invoiceAmount = invoice.gross_amount ?? 0;
  const variancePercent = poAmount > 0
    ? ((invoiceAmount - poAmount) / poAmount) * 100
    : 0;

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    poId: invoice.po_id,
    poNumber: po?.po_number ?? "N/A",
    grnId: invoice.grn_id,
    grnNumber: grn?.grn_number ?? null,
    supplierName: po?.suppliers?.supplier_name ?? "Unknown",
    poAmount,
    grnAmount,
    invoiceAmount,
    variancePercent,
    status: (invoice.three_way_match_status as MatchStatus) || status,
    lineItems,
  };
}

export function useThreeWayMatch(config: MatchConfig = DEFAULT_CONFIG) {
  const queryClient = useQueryClient();

  const matchResultsQuery = useQuery({
    queryKey: ["three-way-match", config],
    queryFn: async () => {
      // Fetch invoices that have a PO linked
      const { data: invoices, error: invErr } = await supabase
        .from("supplier_invoices")
        .select("*")
        .not("po_id", "is", null);
      if (invErr) throw invErr;
      if (!invoices?.length) return [];

      const poIds = [...new Set(invoices.map(i => i.po_id!))];
      const grnIds = [...new Set(invoices.filter(i => i.grn_id).map(i => i.grn_id!))];
      const invoiceIds = invoices.map(i => i.id);

      // Parallel fetches
      const [posRes, poItemsRes, grnsRes, grnItemsRes, invLinesRes] = await Promise.all([
        supabase.from("purchase_orders").select("*, suppliers(supplier_name)").in("id", poIds),
        supabase.from("po_items").select("*").in("po_id", poIds),
        grnIds.length > 0
          ? supabase.from("goods_receipt_notes").select("*").in("id", grnIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        grnIds.length > 0
          ? supabase.from("grn_items").select("*").in("grn_id", grnIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        supabase.from("supplier_invoice_lines").select("*").in("invoice_id", invoiceIds),
      ]);

      if (posRes.error) throw posRes.error;
      if (poItemsRes.error) throw poItemsRes.error;
      if (grnsRes.error) throw grnsRes.error;
      if (grnItemsRes.error) throw grnItemsRes.error;
      if (invLinesRes.error) throw invLinesRes.error;

      const posMap = new Map((posRes.data ?? []).map(p => [p.id, p]));
      const grnsMap = new Map((grnsRes.data ?? []).map(g => [g.id, g]));

      return invoices.map((inv) => {
        const po = posMap.get(inv.po_id!);
        const grn = inv.grn_id ? grnsMap.get(inv.grn_id) : null;
        const items = (poItemsRes.data ?? []).filter(i => i.po_id === inv.po_id);
        const gItems = inv.grn_id
          ? (grnItemsRes.data ?? []).filter(i => i.grn_id === inv.grn_id)
          : [];
        const iLines = (invLinesRes.data ?? []).filter(l => l.invoice_id === inv.id);
        return computeMatchResult(inv, po, grn, items, gItems, iLines, config);
      });
    },
  });

  const statsQuery = useQuery({
    queryKey: ["three-way-match-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_invoices")
        .select("three_way_match_status")
        .not("po_id", "is", null);
      if (error) throw error;

      const counts = { pending: 0, matched: 0, exception: 0, failed: 0 };
      (data ?? []).forEach((row) => {
        const s = (row.three_way_match_status as MatchStatus) || "pending";
        if (s in counts) counts[s as keyof typeof counts]++;
      });
      return counts;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: MatchStatus }) => {
      const { error } = await supabase
        .from("supplier_invoices")
        .update({ three_way_match_status: status })
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["three-way-match"] });
      queryClient.invalidateQueries({ queryKey: ["three-way-match-stats"] });
    },
  });

  const approveMatch = (invoiceId: string) => {
    updateStatusMutation.mutate({ invoiceId, status: "matched" }, {
      onSuccess: () => toast.success("Match approved"),
      onError: (e) => toast.error("Failed to approve: " + e.message),
    });
  };

  const flagException = (invoiceId: string) => {
    updateStatusMutation.mutate({ invoiceId, status: "exception" }, {
      onSuccess: () => toast.success("Flagged as exception"),
      onError: (e) => toast.error("Failed: " + e.message),
    });
  };

  const rejectMatch = (invoiceId: string) => {
    updateStatusMutation.mutate({ invoiceId, status: "failed" }, {
      onSuccess: () => toast.success("Match rejected"),
      onError: (e) => toast.error("Failed: " + e.message),
    });
  };

  const autoMatch = async () => {
    const results = matchResultsQuery.data ?? [];
    const pending = results.filter(r => !r.status || r.status === "pending");
    let approved = 0;
    let exceptions = 0;

    for (const result of pending) {
      // Recompute status ignoring DB value
      const hasAnyMissing = result.lineItems.some(l => l.qtyMatch === "missing" || l.priceMatch === "missing");
      const hasAnyMismatch = result.lineItems.some(l => l.qtyMatch === "mismatch" || l.priceMatch === "mismatch");

      if (!result.grnId || hasAnyMissing) continue; // skip incomplete
      
      const computedStatus: MatchStatus = hasAnyMismatch ? "exception" : "matched";
      
      await supabase
        .from("supplier_invoices")
        .update({ three_way_match_status: computedStatus })
        .eq("id", result.invoiceId);

      if (computedStatus === "matched") approved++;
      else exceptions++;
    }

    queryClient.invalidateQueries({ queryKey: ["three-way-match"] });
    queryClient.invalidateQueries({ queryKey: ["three-way-match-stats"] });
    toast.success(`Auto-match complete: ${approved} matched, ${exceptions} exceptions`);
  };

  return {
    matchResults: matchResultsQuery.data ?? [],
    isLoading: matchResultsQuery.isLoading,
    error: matchResultsQuery.error,
    stats: statsQuery.data ?? { pending: 0, matched: 0, exception: 0, failed: 0 },
    statsLoading: statsQuery.isLoading,
    approveMatch,
    flagException,
    rejectMatch,
    autoMatch,
    isUpdating: updateStatusMutation.isPending,
  };
}
