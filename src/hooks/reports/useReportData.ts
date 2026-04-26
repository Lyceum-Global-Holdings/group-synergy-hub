import { supabase } from "@/integrations/supabase/client";
import { ReportDefinition } from "@/lib/reports/registry";
import { ReportEnvelope, NotesFilterOp } from "@/lib/reports/types";

export interface BuildEnvelopeContext {
  companyName: string;
  companyId: string;
  currency: string;
  generatedBy: string;
  filters: { label: string; value: string }[];
}

function envelopeBase(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  rows: Record<string, unknown>[],
  totals?: Record<string, unknown>,
  period?: { start?: string; end?: string },
  highlightTerms?: Record<string, string[]>,
  highlightWholeCell?: boolean,
): ReportEnvelope {
  return {
    reportCode: def.code,
    title: def.title,
    moduleKey: def.moduleKey,
    standard: def.standard,
    companyName: ctx.companyName,
    currency: ctx.currency,
    periodStart: period?.start,
    periodEnd: period?.end,
    filters: ctx.filters,
    generatedBy: ctx.generatedBy,
    generatedAt: new Date().toISOString(),
    columns: def.columns,
    rows,
    totals,
    highlightTerms,
    highlightWholeCell,
  };
}

function sumCol(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
}

/* ---------------- Notes filter parsing ---------------- */

const VALID_OPS: readonly NotesFilterOp[] = [
  "contains",
  "equals",
  "startsWith",
  "endsWith",
  "notContains",
] as const;

const MAX_TERMS = 5;

export interface ParsedNotesFilter {
  op: NotesFilterOp;
  /** 1+ tokens for "contains"; exactly 1 for the other operators. */
  terms: string[];
}

/**
 * Parse a `textOperator` parameter value into RPC arguments.
 * For "contains", the term string is split on whitespace OUTSIDE double quotes
 * so users can AND multiple words and use "quoted phrases" with embedded spaces.
 * Returns null when the filter is inactive (no/blank term).
 */
export function parseNotesFilter(v: unknown): ParsedNotesFilter | null {
  if (!v || typeof v !== "object") return null;
  const raw = v as { op?: unknown; term?: unknown };
  const op = (VALID_OPS as readonly string[]).includes(String(raw.op))
    ? (raw.op as NotesFilterOp)
    : "contains";
  const term = typeof raw.term === "string" ? raw.term : "";
  const trimmed = term.trim();
  if (!trimmed) return null;

  if (op !== "contains") {
    return { op, terms: [trimmed] };
  }

  // Tokenize: keep "quoted phrases" intact, split everything else on whitespace.
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    const t = (m[1] ?? m[2] ?? "").trim();
    if (t) tokens.push(t);
    if (tokens.length >= MAX_TERMS) break;
  }
  if (tokens.length === 0) return null;
  return { op, terms: tokens };
}

/** Build the highlight-terms map + wholeCell flag for a given operator/terms. */
function buildHighlight(
  columnKey: string,
  parsed: ParsedNotesFilter | null,
): { terms: Record<string, string[]> | undefined; wholeCell: boolean } {
  if (!parsed) return { terms: undefined, wholeCell: false };
  // notContains: nothing matched, by definition — no highlight.
  if (parsed.op === "notContains") return { terms: undefined, wholeCell: false };
  // equals: wrap the entire matching cell.
  if (parsed.op === "equals") {
    return { terms: { [columnKey]: parsed.terms }, wholeCell: true };
  }
  return { terms: { [columnKey]: parsed.terms }, wholeCell: false };
}

/* ---------------- Inventory ---------------- */

export async function fetchStockOnHand(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { locationId?: string | null; categoryId?: string | null; includeZero?: boolean },
): Promise<ReportEnvelope> {
  const { data, error } = await supabase.rpc("report_stock_on_hand", {
    p_company_id: ctx.companyId,
    p_location_id: params.locationId || null,
    p_category_id: params.categoryId || null,
    p_include_zero: params.includeZero ?? false,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    current_stock: sumCol(rows, "current_stock"),
    reserved_quantity: sumCol(rows, "reserved_quantity"),
    available_quantity: sumCol(rows, "available_quantity"),
    stock_value: sumCol(rows, "stock_value"),
  });
}

export async function fetchInventoryValuation(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { asOfDate?: string | null; categoryId?: string | null },
): Promise<ReportEnvelope> {
  const asOf = params.asOfDate ? new Date(params.asOfDate).toISOString() : new Date().toISOString();
  const { data, error } = await supabase.rpc("report_inventory_valuation", {
    p_company_id: ctx.companyId,
    p_as_of_date: asOf,
    p_category_id: params.categoryId || null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    current_stock: sumCol(rows, "current_stock"),
    weighted_avg_value: sumCol(rows, "weighted_avg_value"),
    fifo_value: sumCol(rows, "fifo_value"),
    nrv_adjustment: sumCol(rows, "nrv_adjustment"),
  }, { end: asOf.slice(0, 10) });
}

export async function fetchInventoryAging(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { categoryId?: string | null },
): Promise<ReportEnvelope> {
  const { data, error } = await supabase.rpc("report_inventory_aging", {
    p_company_id: ctx.companyId,
    p_category_id: params.categoryId || null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    current_stock: sumCol(rows, "current_stock"),
    stock_value: sumCol(rows, "stock_value"),
  });
}

export async function fetchAbcClassification(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { categoryId?: string | null },
): Promise<ReportEnvelope> {
  const { data, error } = await supabase.rpc("report_abc_classification", {
    p_company_id: ctx.companyId,
    p_months: 12,
    p_category_id: params.categoryId || null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    consumption_qty: sumCol(rows, "consumption_qty"),
    consumption_value: sumCol(rows, "consumption_value"),
  });
}

/* ---------------- Movement ---------------- */

export async function fetchStockMovement(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: {
    period?: { from?: string; to?: string };
    locationId?: string | null;
    notesContains?: string | null;
  },
): Promise<ReportEnvelope> {
  const from = params.period?.from ? new Date(params.period.from).toISOString() : null;
  const to = params.period?.to ? new Date(params.period.to).toISOString() : null;
  const { data, error } = await supabase.rpc("report_stock_movement_ledger", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_location_id: params.locationId || null,
    p_notes_contains: (params.notesContains || "").trim() || null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const term = (params.notesContains || "").trim();
  return envelopeBase(
    def,
    ctx,
    rows,
    {
      quantity_change: sumCol(rows, "quantity_change"),
      total_value: sumCol(rows, "total_value"),
    },
    { start: from?.slice(0, 10), end: to?.slice(0, 10) },
    term ? { notes: term } : undefined,
  );
}

/* ---------------- Compliance ---------------- */

export async function fetchCycleCountVariance(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: {
    period?: { from?: string; to?: string };
    locationId?: string | null;
    notesContains?: string | null;
  },
): Promise<ReportEnvelope> {
  const from = params.period?.from || null;
  const to = params.period?.to || null;
  const { data, error } = await supabase.rpc("report_cycle_count_variance", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_location_id: params.locationId || null,
    p_notes_contains: (params.notesContains || "").trim() || null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const term = (params.notesContains || "").trim();
  return envelopeBase(
    def,
    ctx,
    rows,
    {
      variance_quantity: sumCol(rows, "variance_quantity"),
      variance_value: sumCol(rows, "variance_value"),
    },
    { start: from ?? undefined, end: to ?? undefined },
    term ? { variance_reason: term } : undefined,
  );
}

export async function fetchBinUtilisation(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { locationId?: string | null },
): Promise<ReportEnvelope> {
  const { data, error } = await supabase.rpc("report_bin_utilisation", {
    p_company_id: ctx.companyId,
    p_location_id: params.locationId || null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    capacity: sumCol(rows, "capacity"),
    current_quantity: sumCol(rows, "current_quantity"),
    available_capacity: sumCol(rows, "available_capacity"),
  });
}

/* ---------------- Receipts ---------------- */

export async function fetchGrnRegister(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { period?: { from?: string; to?: string } },
): Promise<ReportEnvelope> {
  const from = params.period?.from || null;
  const to = params.period?.to || null;
  const { data, error } = await supabase.rpc("report_grn_register", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_supplier_id: null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    line_count: sumCol(rows, "line_count"),
    total_qty_received: sumCol(rows, "total_qty_received"),
    total_value: sumCol(rows, "total_value"),
  }, { start: from ?? undefined, end: to ?? undefined });
}

/* ---------------- Assets & Tools ---------------- */

export async function fetchAssetRegister(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { locationId?: string | null; status?: string },
): Promise<ReportEnvelope> {
  const status = params.status && params.status !== "all" ? params.status : null;
  const { data, error } = await supabase.rpc("report_asset_register", {
    p_company_id: ctx.companyId,
    p_location_id: params.locationId || null,
    p_status: status,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    purchase_price: sumCol(rows, "purchase_price"),
    accumulated_depreciation: sumCol(rows, "accumulated_depreciation"),
    net_book_value: sumCol(rows, "net_book_value"),
  });
}

export async function fetchToolLedger(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { period?: { from?: string; to?: string }; status?: string },
): Promise<ReportEnvelope> {
  const from = params.period?.from || null;
  const to = params.period?.to || null;
  const status = params.status && params.status !== "all" ? params.status : null;
  const { data, error } = await supabase.rpc("report_tool_ledger", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_status: status,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    quantity_issued: sumCol(rows, "quantity_issued"),
    quantity_returned: sumCol(rows, "quantity_returned"),
    outstanding_qty: sumCol(rows, "outstanding_qty"),
  }, { start: from ?? undefined, end: to ?? undefined });
}

/* ---------------- Traceability ---------------- */

export async function fetchBatchTraceability(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: {
    batchNumber?: string;
    itemCode?: string;
    direction?: string;
    notesContains?: string | null;
  },
): Promise<ReportEnvelope> {
  const batch = (params.batchNumber || "").trim() || null;
  const code = (params.itemCode || "").trim() || null;
  if (!batch && !code) {
    throw new Error("Provide either a Batch Number or an Item Code to trace.");
  }
  const { data, error } = await supabase.rpc("report_batch_traceability", {
    p_company_id: ctx.companyId,
    p_batch_number: batch,
    p_item_code: code,
    p_direction: params.direction || "both",
    p_notes_contains: (params.notesContains || "").trim() || null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const term = (params.notesContains || "").trim();
  return envelopeBase(
    def,
    ctx,
    rows,
    undefined,
    undefined,
    term ? { notes: term } : undefined,
  );
}

/* ---------------- Phase 3: generic RPC helper ---------------- */

async function fetchRpc(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  rpcName: string,
  args: Record<string, unknown>,
  period?: { start?: string; end?: string },
): Promise<ReportEnvelope> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(rpcName, args);
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, undefined, period);
}

function periodArgs(p?: { from?: string; to?: string }) {
  return {
    from: p?.from || null,
    to: p?.to || null,
    period: { start: p?.from, end: p?.to },
  };
}

/* ---------------- Dispatcher ---------------- */

export async function buildReportEnvelope(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: Record<string, unknown>,
): Promise<ReportEnvelope> {
  switch (def.hookId) {
    case "warehouse.stockOnHand":
      return fetchStockOnHand(def, ctx, params as never);
    case "warehouse.inventoryValuation":
      return fetchInventoryValuation(def, ctx, params as never);
    case "warehouse.inventoryAging":
      return fetchInventoryAging(def, ctx, params as never);
    case "warehouse.abcClassification":
      return fetchAbcClassification(def, ctx, params as never);
    case "warehouse.stockMovement":
      return fetchStockMovement(def, ctx, params as never);
    case "warehouse.cycleCountVariance":
      return fetchCycleCountVariance(def, ctx, params as never);
    case "warehouse.binUtilisation":
      return fetchBinUtilisation(def, ctx, params as never);
    case "warehouse.grnRegister":
      return fetchGrnRegister(def, ctx, params as never);
    case "warehouse.assetRegister":
      return fetchAssetRegister(def, ctx, params as never);
    case "warehouse.toolLedger":
      return fetchToolLedger(def, ctx, params as never);
    case "warehouse.batchTraceability":
      return fetchBatchTraceability(def, ctx, params as never);

    /* ---- Finance ---- */
    case "finance.trialBalance": {
      const p = params as { asOfDate?: string };
      return fetchRpc(def, ctx, "report_trial_balance", {
        p_company_id: ctx.companyId,
        p_as_of_date: p.asOfDate || new Date().toISOString().slice(0, 10),
      });
    }
    case "finance.generalLedgerDetail": {
      const p = params as { period?: { from?: string; to?: string }; accountId?: string };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_general_ledger_detail", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
        p_account_id: (p.accountId || "").trim() || null,
      }, pa.period);
    }
    case "finance.apAging": {
      const p = params as { asOfDate?: string };
      return fetchRpc(def, ctx, "report_ap_aging", {
        p_company_id: ctx.companyId,
        p_as_of_date: p.asOfDate || new Date().toISOString().slice(0, 10),
        p_supplier_id: null,
      });
    }
    case "finance.arAging": {
      const p = params as { asOfDate?: string };
      return fetchRpc(def, ctx, "report_ar_aging", {
        p_company_id: ctx.companyId,
        p_as_of_date: p.asOfDate || new Date().toISOString().slice(0, 10),
        p_customer_id: null,
      });
    }
    case "finance.fixedAssetRegister": {
      const p = params as { asOfDate?: string };
      return fetchRpc(def, ctx, "report_fixed_asset_register", {
        p_company_id: ctx.companyId,
        p_as_of_date: p.asOfDate || new Date().toISOString().slice(0, 10),
      });
    }
    case "finance.cashBankStatement": {
      const p = params as { period?: { from?: string; to?: string } };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_cash_bank_statement", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
        p_bank_account_id: null,
      }, pa.period);
    }

    /* ---- Procurement ---- */
    case "procurement.prRegister": {
      const p = params as { period?: { from?: string; to?: string } };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_pr_register", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
        p_status: null,
      }, pa.period);
    }
    case "procurement.poRegister": {
      const p = params as { period?: { from?: string; to?: string } };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_po_register", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
        p_status: null,
      }, pa.period);
    }
    case "procurement.openPo":
      return fetchRpc(def, ctx, "report_open_po", { p_company_id: ctx.companyId });
    case "procurement.threeWayMatchExceptions": {
      const p = params as { period?: { from?: string; to?: string } };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_three_way_match_exceptions", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
      }, pa.period);
    }
    case "procurement.spendAnalysis": {
      const p = params as { period?: { from?: string; to?: string } };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_spend_analysis", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
      }, pa.period);
    }

    /* ---- Sourcing ---- */
    case "sourcing.rfqRegister": {
      const p = params as { period?: { from?: string; to?: string } };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_rfq_register", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
        p_status: null,
      }, pa.period);
    }
    case "sourcing.quoteComparison": {
      const p = params as { requestId?: string };
      return fetchRpc(def, ctx, "report_quote_comparison", {
        p_company_id: ctx.companyId,
        p_request_id: (p.requestId || "").trim() || null,
      });
    }
    case "sourcing.supplierScorecard": {
      const p = params as { period?: { from?: string; to?: string } };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_supplier_scorecard", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
      }, pa.period);
    }
    case "sourcing.contractExpiry": {
      const p = params as { horizon?: string };
      return fetchRpc(def, ctx, "report_contract_expiry", {
        p_company_id: ctx.companyId,
        p_horizon_days: Number(p.horizon || 180),
      });
    }

    /* ---- Production ---- */
    case "production.wip":
      return fetchRpc(def, ctx, "report_production_wip", { p_company_id: ctx.companyId });
    case "production.dailyOutput": {
      const p = params as { period?: { from?: string; to?: string } };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_production_daily_output", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
      }, pa.period);
    }
    case "production.stageCost": {
      const p = params as { orderId?: string };
      return fetchRpc(def, ctx, "report_production_stage_cost", {
        p_company_id: ctx.companyId,
        p_order_id: (p.orderId || "").trim() || null,
      });
    }
    case "production.efficiency": {
      const p = params as { period?: { from?: string; to?: string } };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_production_efficiency", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
      }, pa.period);
    }

    /* ---- Construction ---- */
    case "construction.dsrSummary": {
      const p = params as { period?: { from?: string; to?: string } };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_construction_dsr_summary", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
        p_project_id: null,
      }, pa.period);
    }
    case "construction.progress":
      return fetchRpc(def, ctx, "report_construction_progress", { p_company_id: ctx.companyId });
    case "construction.budgetVariance": {
      const p = params as { projectId?: string };
      return fetchRpc(def, ctx, "report_construction_budget_variance", {
        p_company_id: ctx.companyId,
        p_project_id: (p.projectId || "").trim() || null,
      });
    }
    case "construction.materialMovements": {
      const p = params as { period?: { from?: string; to?: string } };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_construction_material_movements", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
      }, pa.period);
    }

    /* ---- Management ---- */
    case "management.pendingApprovals":
      return fetchRpc(def, ctx, "report_pending_approvals", { p_company_id: ctx.companyId });
    case "management.systemAuditLog": {
      const p = params as { period?: { from?: string; to?: string }; module?: string };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_system_audit_log", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
        p_module: (p.module || "").trim() || null,
      }, pa.period);
    }
    case "management.reportUsage": {
      const p = params as { period?: { from?: string; to?: string } };
      const pa = periodArgs(p.period);
      return fetchRpc(def, ctx, "report_report_usage", {
        p_company_id: ctx.companyId,
        p_date_from: pa.from,
        p_date_to: pa.to,
      }, pa.period);
    }

    default:
      throw new Error(`Unknown report hook: ${def.hookId}`);
  }
}
