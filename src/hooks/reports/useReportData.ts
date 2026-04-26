import { supabase } from "@/integrations/supabase/client";
import { ReportDefinition } from "@/lib/reports/registry";
import { ReportEnvelope } from "@/lib/reports/types";

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
  };
}

function sumCol(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
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
  params: { period?: { from?: string; to?: string }; locationId?: string | null },
): Promise<ReportEnvelope> {
  const from = params.period?.from ? new Date(params.period.from).toISOString() : null;
  const to = params.period?.to ? new Date(params.period.to).toISOString() : null;
  const { data, error } = await supabase.rpc("report_stock_movement_ledger", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_location_id: params.locationId || null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    quantity_change: sumCol(rows, "quantity_change"),
    total_value: sumCol(rows, "total_value"),
  }, { start: from?.slice(0, 10), end: to?.slice(0, 10) });
}

/* ---------------- Compliance ---------------- */

export async function fetchCycleCountVariance(
  def: ReportDefinition,
  ctx: BuildEnvelopeContext,
  params: { period?: { from?: string; to?: string }; locationId?: string | null },
): Promise<ReportEnvelope> {
  const from = params.period?.from || null;
  const to = params.period?.to || null;
  const { data, error } = await supabase.rpc("report_cycle_count_variance", {
    p_company_id: ctx.companyId,
    p_date_from: from,
    p_date_to: to,
    p_location_id: params.locationId || null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows, {
    variance_quantity: sumCol(rows, "variance_quantity"),
    variance_value: sumCol(rows, "variance_value"),
  }, { start: from ?? undefined, end: to ?? undefined });
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
  params: { batchNumber?: string; itemCode?: string; direction?: string },
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
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return envelopeBase(def, ctx, rows);
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
    default:
      throw new Error(`Unknown report hook: ${def.hookId}`);
  }
}
