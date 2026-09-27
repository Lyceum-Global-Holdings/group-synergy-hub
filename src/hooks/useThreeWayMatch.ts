import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { untypedRpc } from "@/lib/untypedRpc";

// The match is worked out in the database (migration 20260928130000):
// invoice quantity against the quantity accepted on approved GRNs (all
// receipts, less what earlier invoices already billed) and invoice price
// against the PO price (2% tolerance). A finance user can accept a mismatch
// with a reason or fail the match; the stored result can't be edited directly.

export type MatchStatus = "pending" | "matched" | "exception" | "failed";
export type QtyCheck = "match" | "over" | "not_received" | "not_invoiced" | "extra";
export type PriceCheck = "match" | "tolerance" | "under" | "over" | "missing";

export interface MatchLineItem {
  poItemId: string | null;
  itemName: string;
  itemCode: string | null;
  unitOfMeasure: string | null;
  poQty: number | null;
  poUnitPrice: number | null;
  receivedQty: number | null;
  invoicedBefore: number | null;
  invoiceQty: number | null;
  invoiceUnitPrice: number | null;
  qtyCheck: QtyCheck;
  priceCheck: PriceCheck;
}

export interface MatchResult {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  supplierName: string;
  poId: string;
  poNumber: string;
  grnNumbers: string | null;
  poAmount: number;
  receivedAmount: number;
  invoiceAmount: number;
  variancePercent: number;
  /** What the screen shows: a person's decision if there is one, else the live check. */
  status: MatchStatus;
  /** The live check against today's receipts. */
  computedStatus: MatchStatus;
  storedStatus: string;
  decided: boolean;
  notes: string | null;
  lineItems: MatchLineItem[];
}

interface OverviewRow {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  currency: string | null;
  supplier_name: string;
  po_id: string;
  po_number: string;
  grn_numbers: string | null;
  po_amount: number | string;
  received_amount: number | string;
  invoice_amount: number | string;
  stored_status: string;
  computed_status: string;
  decided: boolean;
  notes: string | null;
  lines: Array<Record<string, unknown>>;
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Stored values from older screens and the e-invoice sync mapped to the four the screen uses. */
export function toMatchStatus(value: string | null | undefined): MatchStatus {
  switch (value) {
    case "matched":
    case "auto_matched":
      return "matched";
    case "failed":
      return "failed";
    case "exception":
    case "mismatch":
    case "partial":
      return "exception";
    default:
      return "pending";
  }
}

export function toMatchResult(row: OverviewRow): MatchResult {
  const poAmount = Number(row.po_amount || 0);
  const invoiceAmount = Number(row.invoice_amount || 0);
  const computedStatus = toMatchStatus(row.computed_status);
  return {
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    currency: row.currency || "LKR",
    supplierName: row.supplier_name,
    poId: row.po_id,
    poNumber: row.po_number,
    grnNumbers: row.grn_numbers,
    poAmount,
    receivedAmount: Number(row.received_amount || 0),
    invoiceAmount,
    variancePercent: poAmount > 0 ? ((invoiceAmount - poAmount) / poAmount) * 100 : 0,
    status: row.decided ? toMatchStatus(row.stored_status) : computedStatus,
    computedStatus,
    storedStatus: row.stored_status,
    decided: row.decided,
    notes: row.notes,
    lineItems: (row.lines ?? []).map((l) => ({
      poItemId: (l.po_item_id as string) ?? null,
      itemName: String(l.item_name ?? ""),
      itemCode: (l.item_code as string) ?? null,
      unitOfMeasure: (l.unit_of_measure as string) ?? null,
      poQty: n(l.po_qty),
      poUnitPrice: n(l.po_unit_price),
      receivedQty: n(l.received_qty),
      invoicedBefore: n(l.invoiced_before),
      invoiceQty: n(l.invoice_qty),
      invoiceUnitPrice: n(l.invoice_unit_price),
      qtyCheck: l.qty_status as QtyCheck,
      priceCheck: l.price_status as PriceCheck,
    })),
  };
}

export function useThreeWayMatch() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["three-way-match"] });
    qc.invalidateQueries({ queryKey: ["reports"] });
  };

  const matchResultsQuery = useQuery({
    queryKey: ["three-way-match", companyId],
    queryFn: async () => {
      const rows = await untypedRpc<OverviewRow[]>("three_way_match_overview", { p_company_id: companyId });
      return (rows ?? []).map(toMatchResult);
    },
    enabled: !!companyId,
  });

  const runAll = useMutation({
    mutationFn: () =>
      untypedRpc<Array<{ matched: number; exceptions: number; pending: number }>>("run_three_way_match_all", { p_company_id: companyId }),
    onSuccess: (rows) => {
      refresh();
      const r = rows?.[0] ?? { matched: 0, exceptions: 0, pending: 0 };
      toast.success(`Matching saved: ${r.matched} matched, ${r.exceptions} exceptions, ${r.pending} waiting for goods or lines`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: ({ invoiceId, accept, reason }: { invoiceId: string; accept: boolean; reason?: string }) =>
      untypedRpc<string>("decide_three_way_match", { p_invoice_id: invoiceId, p_accept: accept, p_reason: reason || null }),
    onSuccess: (_, { accept }) => {
      refresh();
      toast.success(accept ? "Match accepted" : "Match failed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const results = matchResultsQuery.data ?? [];
  const stats = { pending: 0, matched: 0, exception: 0, failed: 0 };
  for (const r of results) stats[r.status]++;

  return {
    matchResults: results,
    isLoading: matchResultsQuery.isLoading,
    error: matchResultsQuery.error,
    stats,
    runAll: () => runAll.mutate(),
    isRunning: runAll.isPending,
    decide: (invoiceId: string, accept: boolean, reason?: string, onDone?: () => void) =>
      decide.mutate({ invoiceId, accept, reason }, { onSuccess: () => onDone?.() }),
    isUpdating: decide.isPending,
  };
}
