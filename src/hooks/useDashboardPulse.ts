import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeChannel } from "@/hooks/useRealtimeBus";

const STALE = 15_000;

export interface WarehousePulse {
  on_hand_value: number;
  low_stock_count: number;
  sku_count: number;
  moves_24h: number;
  sparkline_7d: Array<{ d: string; v: number }>;
}

export interface ProcurementPulse {
  open_count: number;
  pending_approval: number;
  approved_today: number;
  spend_mtd: number;
  spend_last_month: number;
  pending_grn: number;
  sparkline_7d: Array<{ d: string; v: number }>;
}

export interface SourcingPulse {
  open_rfqs: number;
  closing_7d: number;
  awarded_today: number;
  active_suppliers: number;
  new_suppliers_30d: number;
}

export interface FinancePulse {
  outstanding_payables: number;
  overdue_invoices: number;
  overdue_amount: number;
  pending_payments: number;
  pending_payment_amount: number;
}

export interface HealthStrip {
  po_today: number;
  po_yesterday: number;
  grn_pending: number;
  low_stock: number;
  rfqs_open: number;
  approvals_pending: number;
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw error;
  return data as T;
}

export function useWarehousePulse(companyId?: string | null, locationId?: string | null) {
  return useQuery({
    queryKey: ["dashboard-pulse", "warehouse", companyId, locationId],
    queryFn: () =>
      callRpc<WarehousePulse>("get_dashboard_warehouse_pulse", {
        p_company_id: companyId ?? null,
        p_location_id: locationId ?? null,
      }),
    staleTime: STALE,
  });
}

export function useProcurementPulse(companyId?: string | null) {
  return useQuery({
    queryKey: ["dashboard-pulse", "procurement", companyId],
    queryFn: () =>
      callRpc<ProcurementPulse>("get_dashboard_procurement_pulse", {
        p_company_id: companyId ?? null,
      }),
    staleTime: STALE,
  });
}

export function useSourcingPulse(companyId?: string | null) {
  return useQuery({
    queryKey: ["dashboard-pulse", "sourcing", companyId],
    queryFn: () =>
      callRpc<SourcingPulse>("get_dashboard_sourcing_pulse", {
        p_company_id: companyId ?? null,
      }),
    staleTime: STALE,
  });
}

export function useFinancePulse(companyId?: string | null) {
  return useQuery({
    queryKey: ["dashboard-pulse", "finance", companyId],
    queryFn: () =>
      callRpc<FinancePulse>("get_dashboard_finance_pulse", {
        p_company_id: companyId ?? null,
      }),
    staleTime: STALE,
  });
}

export interface DashboardAnalytics {
  material_flow: Array<{ d: string; issued: number; returned: number }>;
  inbound_outbound: Array<{ d: string; inbound: number; outbound: number }>;
  top_issued: Array<{ item_id: string; name: string; item_code: string | null; qty: number }>;
  top_returned: Array<{ item_id: string; name: string; item_code: string | null; qty: number }>;
  movement_mix: Array<{ type: string; count: number }>;
  spend_trend: Array<{ w: string; amount: number }>;
}

export function useDashboardAnalytics(companyId?: string | null, locationId?: string | null) {
  return useQuery({
    queryKey: ["dashboard-pulse", "analytics", companyId, locationId],
    queryFn: () =>
      callRpc<DashboardAnalytics>("get_dashboard_analytics", {
        p_company_id: companyId ?? null,
        p_location_id: locationId ?? null,
      }),
    staleTime: 30_000,
  });
}

export function useHealthStrip(companyId?: string | null, locationId?: string | null) {
  return useQuery({
    queryKey: ["dashboard-pulse", "health", companyId, locationId],
    queryFn: () =>
      callRpc<HealthStrip>("get_dashboard_health_strip", {
        p_company_id: companyId ?? null,
        p_location_id: locationId ?? null,
      }),
    staleTime: STALE,
  });
}

/**
 * Subscribes to all realtime tables that feed the dashboard and
 * (a) invalidates pulse queries (debounced) and
 * (b) returns a `live` flag that pulses true for 4 seconds after each event.
 */
export function useDashboardRealtime() {
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const timerRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);

  const ping = () => {
    setLive(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setLive(false), 4000);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      qc.invalidateQueries({ queryKey: ["dashboard-pulse"] });
    }, 800);
  };

  useRealtimeChannel("purchase_orders", ping);
  useRealtimeChannel("goods_receipt_notes", ping);
  useRealtimeChannel("warehouse_items", ping);
  useRealtimeChannel("stock_transactions", ping);
  useRealtimeChannel("rfq_rfp_requests", ping);
  useRealtimeChannel("suppliers", ping);
  useRealtimeChannel("supplier_invoices", ping);
  useRealtimeChannel("supplier_payments", ping);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    },
    [],
  );

  return { live };
}
