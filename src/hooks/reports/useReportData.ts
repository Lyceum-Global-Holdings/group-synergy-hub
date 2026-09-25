import { ReportDefinition } from "@/lib/reports/registry";
import { ReportEnvelope, NotesFilterOp } from "@/lib/reports/types";
import { parseIsoDate, toIsoDate, trailingMonths } from "@/lib/reports/period";
import { beginReportRun, rpcAll, REPORT_ROW_CAP } from "./rpcAll";

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
  extraNotes?: string[],
): ReportEnvelope {
  const notes = [...(def.methodology ?? []), ...(extraNotes ?? [])];
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
    notes: notes.length ? notes : undefined,
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
 *
 * Tokenisation rules (aligned with SAP Fiori smart-filter, Excel AutoFilter
 * "Contains", Jira basic search and ISO 25964-1 thesaurus search):
 *   - Unquoted text is treated as ONE literal substring, exactly as typed,
 *     spaces preserved. So `Bulk stock upload` matches notes containing the
 *     full phrase "Bulk stock upload" — not three separate words.
 *   - Each `"quoted phrase"` becomes its own AND token.
 *     e.g. `"return to vendor" urgent`  →  notes must contain BOTH
 *          `return to vendor` AND `urgent`.
 *   - Everything outside the quotes is collapsed into ONE additional literal
 *     token (trimmed) so users cannot accidentally trigger a strict AND of
 *     every word in their input.
 *
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

  // Non-contains operators always treat the term as one literal string.
  if (op !== "contains") {
    return { op, terms: [trimmed] };
  }

  // No quotes → entire input is one literal substring (the common case).
  if (!trimmed.includes('"')) {
    return { op, terms: [trimmed] };
  }

  // Mixed input: extract every "quoted phrase" as its own AND token, and
  // collapse the remaining unquoted fragments into a single literal token.
  const tokens: string[] = [];
  let unquotedBuf = "";
  const re = /"([^"]*)"|([^"]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    if (m[1] !== undefined) {
      const phrase = m[1].trim();
      if (phrase) tokens.push(phrase);
    } else if (m[2] !== undefined) {
      unquotedBuf += m[2];
    }
  }
  const tail = unquotedBuf.trim();
  if (tail) tokens.push(tail);

  const capped = tokens.slice(0, MAX_TERMS);
  if (capped.length === 0) return null;
  return { op, terms: capped };
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
  params: {
    locationId?: string | null;
    categoryId?: string | null;
    includeZero?: boolean;
    binId?: string | null;
    binIds?: { mode?: "include" | "exclude"; binIds?: string[] } | null;
    binWise?: boolean;
  },
): Promise<ReportEnvelope> {
  const bm = params.binIds ?? null;
  const mode = bm?.mode === "exclude" ? "exclude" : "include";
  const ids = Array.isArray(bm?.binIds) ? bm!.binIds!.filter(Boolean) : [];
  const p_include_bin_ids = mode === "include" && ids.length > 0 ? ids : null;
  const p_exclude_bin_ids = mode === "exclude" && ids.length > 0 ? ids : null;

  const { data, error } = await rpcAll("report_stock_on_hand", {
    p_company_id: ctx.companyId,
    p_location_id: params.locationId || null,
    p_category_id: params.categoryId || null,
    p_include_zero: params.includeZero ?? false,
    p_bin_id: params.binId || null,
    p_bin_wise: params.binWise ?? false,
    p_include_bin_ids,
    p_exclude_bin_ids,
  } as never);
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    current_stock: sumCol(rows, "current_stock"),
    reserved_quantity: sumCol(rows, "reserved_quantity"),
    available_quantity: sumCol(rows, "available_quantity"),
    stock_value: sumCol(rows, "stock_value"),
  });
}

export async function fetchItemStockAvailability(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: {
    catalogItemId?: string | null;
    searchPhrase?: string | null;
    locationId?: string | null;
    binId?: string | null;
    groupBy?: string | null;
    includeZero?: boolean;
    includeBatches?: boolean;
  },
): Promise<ReportEnvelope> {
  const phrase = (params.searchPhrase ?? "").trim();
  // Either an explicit item or a non-empty phrase is required; otherwise
  // return an empty envelope so the preview shows a friendly empty state.
  if (!params.catalogItemId && !phrase) {
    return envelopeBase(def, ctx, []);
  }
  const { data, error } = await rpcAll("report_item_stock_availability", {
    p_catalog_item_id: params.catalogItemId || null,
    p_search_phrase: phrase || null,
    p_location_id: params.locationId || null,
    p_bin_id: params.binId || null,
    p_group_by: params.groupBy || "bin",
    p_include_zero: params.includeZero ?? false,
    p_include_batches: params.includeBatches ?? false,
  } as never);
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    on_hand_qty: sumCol(rows, "on_hand_qty"),
    reserved_qty: sumCol(rows, "reserved_qty"),
    available_qty: sumCol(rows, "available_qty"),
    stock_value: sumCol(rows, "stock_value"),
  });
}


export async function fetchInventoryValuation(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { asOfDate?: string | null; categoryId?: string | null },
): Promise<ReportEnvelope> {
  const asOf = params.asOfDate ? new Date(params.asOfDate).toISOString() : new Date().toISOString();
  const { data, error } = await rpcAll("report_inventory_valuation", {
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
  const { data, error } = await rpcAll("report_inventory_aging", {
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
  const { data, error } = await rpcAll("report_abc_classification", {
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
    notesFilter?: unknown;
  },
): Promise<ReportEnvelope> {
  const from = params.period?.from ? new Date(params.period.from).toISOString() : null;
  const to = params.period?.to ? new Date(params.period.to).toISOString() : null;
  const parsed = parseNotesFilter(params.notesFilter);
  const { data, error } = await rpcAll("report_stock_movement_ledger", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_location_id: params.locationId || null,
    p_notes_op: parsed?.op ?? "contains",
    p_notes_terms: parsed?.terms ?? null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const hl = buildHighlight("notes", parsed);
  return envelopeBase(
    def,
    ctx,
    rows,
    {
      quantity_change: sumCol(rows, "quantity_change"),
      total_value: sumCol(rows, "total_value"),
    },
    { start: from?.slice(0, 10), end: to?.slice(0, 10) },
    hl.terms,
    hl.wholeCell,
  );
}

/* ---------------- Partial Pieces ---------------- */

export async function fetchPartialPiecesOnHand(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: {
    locationId?: string | null;
    binId?: string | null;
    categoryId?: string | null;
    status?: string | null;
    includeZero?: boolean;
  },
): Promise<ReportEnvelope> {
  const { data, error } = await rpcAll("report_partial_pieces_on_hand", {
    p_company_id: ctx.companyId,
    p_location_id: params.locationId || null,
    p_bin_id: params.binId || null,
    p_category_id: params.categoryId || null,
    p_item_id: null,
    p_status: params.status || "available",
    p_include_zero: params.includeZero ?? false,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    piece_count: sumCol(rows, "piece_count"),
    total_size: sumCol(rows, "total_size"),
    stock_value: sumCol(rows, "stock_value"),
  });
}

export async function fetchPartialPiecesMovement(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: {
    period?: { from?: string; to?: string };
    locationId?: string | null;
    binId?: string | null;
    eventType?: string | null;
    notesFilter?: unknown;
  },
): Promise<ReportEnvelope> {
  const from = params.period?.from ? new Date(params.period.from).toISOString() : null;
  const to = params.period?.to ? new Date(params.period.to).toISOString() : null;
  const parsed = parseNotesFilter(params.notesFilter);
  const { data, error } = await rpcAll("report_partial_pieces_movement", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_location_id: params.locationId || null,
    p_bin_id: params.binId || null,
    p_item_id: null,
    p_event_type: params.eventType && params.eventType !== "all" ? params.eventType : null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const hl = buildHighlight("notes", parsed);
  return envelopeBase(
    def,
    ctx,
    rows,
    {
      event_pieces: sumCol(rows, "event_pieces"),
      event_qty: sumCol(rows, "event_qty"),
      event_value: sumCol(rows, "event_value"),
    },
    { start: from?.slice(0, 10), end: to?.slice(0, 10) },
    hl.terms,
    hl.wholeCell,
  );
}


export async function fetchCycleCountVariance(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: {
    period?: { from?: string; to?: string };
    locationId?: string | null;
    notesFilter?: unknown;
  },
): Promise<ReportEnvelope> {
  const from = params.period?.from || null;
  const to = params.period?.to || null;
  const parsed = parseNotesFilter(params.notesFilter);
  const { data, error } = await rpcAll("report_cycle_count_variance", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_location_id: params.locationId || null,
    p_notes_op: parsed?.op ?? "contains",
    p_notes_terms: parsed?.terms ?? null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const hl = buildHighlight("variance_reason", parsed);
  return envelopeBase(
    def,
    ctx,
    rows,
    {
      variance_quantity: sumCol(rows, "variance_quantity"),
      variance_value: sumCol(rows, "variance_value"),
    },
    { start: from ?? undefined, end: to ?? undefined },
    hl.terms,
    hl.wholeCell,
  );
}

export async function fetchBinUtilisation(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { locationId?: string | null },
): Promise<ReportEnvelope> {
  const { data, error } = await rpcAll("report_bin_utilisation", {
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
  const { data, error } = await rpcAll("report_grn_register", {
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

export async function fetchFreightSummary(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { period?: { from?: string; to?: string }; locationId?: string | null },
): Promise<ReportEnvelope> {
  const from = params.period?.from || null;
  const to = params.period?.to || null;
  const { data, error } = await rpcAll("report_freight_cost_summary", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_location_id: params.locationId || null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    grn_count: sumCol(rows, "grn_count"),
    total_freight: sumCol(rows, "total_freight"),
  }, { start: from ?? undefined, end: to ?? undefined });
}

export async function fetchFreightRegister(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { period?: { from?: string; to?: string }; locationId?: string | null },
): Promise<ReportEnvelope> {
  const from = params.period?.from || null;
  const to = params.period?.to || null;
  const { data, error } = await rpcAll("report_freight_register", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_location_id: params.locationId || null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    transport_cost: sumCol(rows, "transport_cost"),
    grand_total: sumCol(rows, "grand_total"),
  }, { start: from ?? undefined, end: to ?? undefined });
}

/* ---------------- Assets & Tools ---------------- */

export async function fetchAssetRegister(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { locationId?: string | null; status?: string },
): Promise<ReportEnvelope> {
  const status = params.status && params.status !== "all" ? params.status : null;
  const { data, error } = await rpcAll("report_asset_register", {
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
  const { data, error } = await rpcAll("report_tool_ledger", {
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

export async function fetchToolCalibrationDue(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { period?: { from?: string; to?: string }; status?: string },
): Promise<ReportEnvelope> {
  const from = params.period?.from || null;
  const to = params.period?.to || null;
  const status = params.status && params.status !== "all" ? params.status : null;
  const { data, error } = await rpcAll("report_tool_calibration_due", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_status: status,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, undefined, { start: from ?? undefined, end: to ?? undefined });
}

export async function fetchToolCalibrationHistory(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { period?: { from?: string; to?: string }; result?: string },
): Promise<ReportEnvelope> {
  const from = params.period?.from || null;
  const to = params.period?.to || null;
  const result = params.result && params.result !== "all" ? params.result : null;
  const { data, error } = await rpcAll("report_tool_calibration_history", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_result: result,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, { cost: sumCol(rows, "cost") }, { start: from ?? undefined, end: to ?? undefined });
}

export async function fetchToolCost(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { period?: { from?: string; to?: string } },
): Promise<ReportEnvelope> {
  const from = params.period?.from || null;
  const to = params.period?.to || null;
  const { data, error } = await rpcAll("report_tool_cost", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    calibration_cost: sumCol(rows, "calibration_cost"),
    maintenance_cost: sumCol(rows, "maintenance_cost"),
    total_cost: sumCol(rows, "total_cost"),
  }, { start: from ?? undefined, end: to ?? undefined });
}

export async function fetchToolMaintenanceDue(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { period?: { from?: string; to?: string }; status?: string },
): Promise<ReportEnvelope> {
  const from = params.period?.from || null;
  const to = params.period?.to || null;
  const status = params.status && params.status !== "all" ? params.status : null;
  const { data, error } = await rpcAll("report_tool_maintenance_due", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_status: status,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, undefined, { start: from ?? undefined, end: to ?? undefined });
}

export async function fetchToolMaintenanceHistory(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { period?: { from?: string; to?: string }; type?: string },
): Promise<ReportEnvelope> {
  const from = params.period?.from || null;
  const to = params.period?.to || null;
  const type = params.type && params.type !== "all" ? params.type : null;
  const { data, error } = await rpcAll("report_tool_maintenance_history", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_type: type,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, { cost: sumCol(rows, "cost") }, { start: from ?? undefined, end: to ?? undefined });
}

/* ---------------- Traceability ---------------- */

export async function fetchBatchTraceability(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: {
    batchNumber?: string;
    itemCode?: string;
    direction?: string;
    notesFilter?: unknown;
  },
): Promise<ReportEnvelope> {
  const batch = (params.batchNumber || "").trim() || null;
  const code = (params.itemCode || "").trim() || null;
  if (!batch && !code) {
    throw new Error("Provide either a Batch Number or an Item Code to trace.");
  }
  const parsed = parseNotesFilter(params.notesFilter);
  const { data, error } = await rpcAll("report_batch_traceability", {
    p_company_id: ctx.companyId,
    p_batch_number: batch,
    p_item_code: code,
    p_direction: params.direction || "both",
    p_notes_op: parsed?.op ?? "contains",
    p_notes_terms: parsed?.terms ?? null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const hl = buildHighlight("notes", parsed);
  return envelopeBase(
    def,
    ctx,
    rows,
    undefined,
    undefined,
    hl.terms,
    hl.wholeCell,
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
  const { data, error } = await rpcAll(rpcName, args);
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

/* ---------------- Purchase price intelligence ---------------- */

interface PriceReportParams {
  basis?: string;
  period?: { from?: string; to?: string };
  asOf?: string;
  catalogItemId?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
  locationId?: string | null;
}

export type PriceBasis = "received" | "ordered";

export function priceBasisOf(p: { basis?: string }): PriceBasis {
  return p.basis === "ordered" ? "ordered" : "received";
}

/** Common RPC args; POs have no location, so it is dropped for the ordered basis. */
function priceArgs(ctx: BuildEnvelopeContext, p: PriceReportParams, basis: PriceBasis) {
  return {
    p_company_id: ctx.companyId,
    p_basis: basis,
    p_catalog_item_id: p.catalogItemId || null,
    p_category_id: p.categoryId || null,
    p_location_id: basis === "received" ? p.locationId || null : null,
  };
}

function priceExtraNotes(p: PriceReportParams, basis: PriceBasis): string[] {
  return basis === "ordered" && p.locationId
    ? ["The location filter was ignored: purchase orders carry no location (ordered basis)."]
    : [];
}

async function callPriceRpc(rpc: string, args: Record<string, unknown>) {
  const { data, error } = await rpcAll(rpc, args);
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

/* ---------------- Dispatcher ---------------- */

async function buildReportEnvelopeInner(
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
    case "warehouse.partialPiecesOnHand":
      return fetchPartialPiecesOnHand(def, ctx, params as never);
    case "warehouse.itemStockAvailability":
      return fetchItemStockAvailability(def, ctx, params as never);
    case "warehouse.partialPiecesMovement":
      return fetchPartialPiecesMovement(def, ctx, params as never);
    case "warehouse.cycleCountVariance":
      return fetchCycleCountVariance(def, ctx, params as never);
    case "warehouse.binUtilisation":
      return fetchBinUtilisation(def, ctx, params as never);
    case "warehouse.grnRegister":
      return fetchGrnRegister(def, ctx, params as never);
    case "warehouse.freightSummary":
      return fetchFreightSummary(def, ctx, params as never);
    case "warehouse.freightRegister":
      return fetchFreightRegister(def, ctx, params as never);
    case "warehouse.assetRegister":
      return fetchAssetRegister(def, ctx, params as never);
    case "warehouse.toolLedger":
      return fetchToolLedger(def, ctx, params as never);
    case "warehouse.toolCalibrationDue":
      return fetchToolCalibrationDue(def, ctx, params as never);
    case "warehouse.toolCalibrationHistory":
      return fetchToolCalibrationHistory(def, ctx, params as never);
    case "warehouse.toolMaintenanceDue":
      return fetchToolMaintenanceDue(def, ctx, params as never);
    case "warehouse.toolMaintenanceHistory":
      return fetchToolMaintenanceHistory(def, ctx, params as never);
    case "warehouse.toolCost":
      return fetchToolCost(def, ctx, params as never);
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
    case "procurement.priceTrend": {
      const p = params as PriceReportParams;
      const basis = priceBasisOf(p);
      const asOf = p.asOf || toIsoDate(new Date());
      const rows = await callPriceRpc("report_purchase_price_trend", {
        ...priceArgs(ctx, p, basis),
        p_as_of: asOf,
        p_supplier_id: p.supplierId || null,
      });
      return envelopeBase(
        def, ctx, rows,
        { spend_12m: sumCol(rows, "spend_12m") },
        { start: trailingMonths(12, parseIsoDate(asOf)).from, end: asOf },
        undefined, undefined,
        priceExtraNotes(p, basis),
      );
    }
    case "procurement.purchaseHistory": {
      const p = params as PriceReportParams;
      const basis = priceBasisOf(p);
      const pa = periodArgs(p.period);
      const rows = (
        await callPriceRpc("report_purchase_history", {
          ...priceArgs(ctx, p, basis),
          p_date_from: pa.from,
          p_date_to: pa.to,
          p_supplier_id: p.supplierId || null,
        })
      ).map((r) => ({ ...r, item_link: r.unlinked ? "Free text" : "Catalog" }));
      return envelopeBase(
        def, ctx, rows,
        { line_value_base: sumCol(rows, "line_value_base") },
        pa.period,
        undefined, undefined,
        priceExtraNotes(p, basis),
      );
    }
    case "procurement.supplierPriceComparison": {
      const p = params as PriceReportParams;
      const basis = priceBasisOf(p);
      const pa = periodArgs(p.period);
      const rows = await callPriceRpc("report_supplier_price_comparison", {
        ...priceArgs(ctx, p, basis),
        p_date_from: pa.from,
        p_date_to: pa.to,
      });
      return envelopeBase(
        def, ctx, rows,
        { spend: sumCol(rows, "spend") },
        pa.period,
        undefined, undefined,
        priceExtraNotes(p, basis),
      );
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

/**
 * Build a report envelope. Every report returns at most REPORT_ROW_CAP rows;
 * when a result is cut off there, the output says so (preview banner and a
 * note on every export) instead of silently truncating.
 */
export async function buildReportEnvelope(
  ...args: Parameters<typeof buildReportEnvelopeInner>
): Promise<ReportEnvelope> {
  const run = beginReportRun();
  const envelope = await buildReportEnvelopeInner(...args);
  if (!run.truncated) return envelope;
  const note = `Output limited to the first ${REPORT_ROW_CAP.toLocaleString("en-US")} rows — narrow the filters to see the rest.`;
  return { ...envelope, rowLimit: REPORT_ROW_CAP, notes: [note, ...(envelope.notes ?? [])] };
}
