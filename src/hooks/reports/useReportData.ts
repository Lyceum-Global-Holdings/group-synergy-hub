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

  const totals = {
    current_stock: rows.reduce((s, r) => s + Number(r.current_stock ?? 0), 0),
    reserved_quantity: rows.reduce((s, r) => s + Number(r.reserved_quantity ?? 0), 0),
    available_quantity: rows.reduce((s, r) => s + Number(r.available_quantity ?? 0), 0),
    stock_value: rows.reduce((s, r) => s + Number(r.stock_value ?? 0), 0),
  };
  return envelopeBase(def, ctx, rows, totals);
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

  const totals = {
    current_stock: rows.reduce((s, r) => s + Number(r.current_stock ?? 0), 0),
    weighted_avg_value: rows.reduce((s, r) => s + Number(r.weighted_avg_value ?? 0), 0),
    fifo_value: rows.reduce((s, r) => s + Number(r.fifo_value ?? 0), 0),
    nrv_adjustment: rows.reduce((s, r) => s + Number(r.nrv_adjustment ?? 0), 0),
  };

  return envelopeBase(def, ctx, rows, totals, { end: asOf.slice(0, 10) });
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

  const totals = {
    current_stock: rows.reduce((s, r) => s + Number(r.current_stock ?? 0), 0),
    stock_value: rows.reduce((s, r) => s + Number(r.stock_value ?? 0), 0),
  };
  return envelopeBase(def, ctx, rows, totals);
}

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
    default:
      throw new Error(`Unknown report hook: ${def.hookId}`);
  }
}
