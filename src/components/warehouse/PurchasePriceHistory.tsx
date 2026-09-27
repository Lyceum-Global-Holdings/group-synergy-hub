import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, History, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { MONTH_PRESETS, toIsoDate, trailingMonths } from "@/lib/reports/period";
import { cn } from "@/lib/utils";
import { useAccessibleNav } from "@/components/layout/useAccessibleNav";

type Basis = "received" | "ordered";
type Months = 1 | 3 | 6 | 12;

interface TrendRow {
  uom: string;
  wap_1m: number | null;
  wap_3m: number | null;
  wap_6m: number | null;
  wap_12m: number | null;
  qty_1m: number | null;
  qty_3m: number | null;
  qty_6m: number | null;
  qty_12m: number | null;
  last_price: number | null;
  last_date: string | null;
  last_supplier: string | null;
  chg_last_vs_12m: number | null;
  fx_missing: number;
}

interface HistoryRow {
  txn_date: string;
  doc_number: string;
  po_number: string | null;
  supplier_name: string;
  uom: string;
  quantity: number;
  txn_currency: string;
  net_unit_price: number;
  net_unit_price_base: number | null;
  chg_vs_prev: number | null;
}

interface Props {
  catalogItemId: string | null;
  /** Kept for call-site compatibility; history is keyed by catalog item. */
  warehouseItemId?: string | null;
  /** The item's own company — used when no company is selected in the header. */
  companyId?: string | null;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw error;
  return (data ?? []) as T[];
}

const BASES: { key: Basis; label: string }[] = [
  { key: "received", label: "Received" },
  { key: "ordered", label: "Ordered" },
];

/**
 * Per-item purchase price history for the active company: weighted-average
 * price (IAS 2) over 1/3/6/12-month windows, base currency (IAS 21), on the
 * received (GRN net) or ordered (PO) basis. Backed by the same RPCs as the
 * Reports Center price reports, so the numbers match.
 */
export function PurchasePriceHistory({ catalogItemId, companyId: itemCompanyId }: Props) {
  const { selectedCompany, formatCurrency } = useCompany();
  const canOpenReports = useAccessibleNav().canOpenPath("/management/reports");
  const companyId = selectedCompany?.id ?? itemCompanyId ?? null;
  const [basis, setBasis] = useState<Basis>("received");
  const [months, setMonths] = useState<Months>(12);
  const today = toIsoDate(new Date());
  const range = trailingMonths(months);
  const enabled = !!(companyId && catalogItemId);

  const trendQuery = useQuery({
    queryKey: ["item-price-trend", companyId, catalogItemId, basis, today],
    queryFn: () =>
      rpc<TrendRow>("report_purchase_price_trend", {
        p_company_id: companyId,
        p_basis: basis,
        p_as_of: today,
        p_catalog_item_id: catalogItemId,
      }),
    enabled,
    staleTime: 60_000,
  });

  const historyQuery = useQuery({
    queryKey: ["item-price-history", companyId, catalogItemId, basis, range.from, range.to],
    queryFn: () =>
      rpc<HistoryRow>("report_purchase_history", {
        p_company_id: companyId,
        p_basis: basis,
        p_date_from: range.from,
        p_date_to: range.to,
        p_catalog_item_id: catalogItemId,
      }),
    enabled,
    staleTime: 60_000,
  });

  // An item bought in more than one unit gets one trend row per unit; show the
  // unit with the most 12-month volume and mention the others.
  const trendRows = trendQuery.data ?? [];
  const trend = [...trendRows].sort((a, b) => Number(b.qty_12m ?? 0) - Number(a.qty_12m ?? 0))[0];
  const otherUnits = trendRows.filter((r) => r !== trend).map((r) => r.uom);

  const history = useMemo(
    () => (historyQuery.data ?? []).filter((r) => !trend || r.uom === trend.uom),
    [historyQuery.data, trend],
  );
  const priced = history.filter((r) => Number(r.net_unit_price_base) > 0);
  const windowMin = priced.length ? Math.min(...priced.map((r) => Number(r.net_unit_price_base))) : null;
  const windowMax = priced.length ? Math.max(...priced.map((r) => Number(r.net_unit_price_base))) : null;
  const spark = [...priced]
    .sort((a, b) => a.txn_date.localeCompare(b.txn_date))
    .map((r) => ({ d: r.txn_date, v: Number(r.net_unit_price_base) }));

  const wap = trend ? trend[`wap_${months}m` as const] : null;
  const qty = trend ? trend[`qty_${months}m` as const] : null;
  const change = trend?.chg_last_vs_12m ?? null;
  const money = (v: number | null | undefined) => (v === null || v === undefined ? "—" : formatCurrency(Number(v)));

  const reportLink = (code: string) => {
    const q = new URLSearchParams({ template: code, module: "procurement", basis });
    if (catalogItemId) q.set("catalogItemId", catalogItemId);
    if (code !== "PR-PRC-TRD-001") q.set("period", `${range.from}|${range.to}`);
    return `/management/reports?${q.toString()}`;
  };

  const error = (trendQuery.error ?? historyQuery.error) as { code?: string; message?: string } | null;
  const loading = trendQuery.isLoading || historyQuery.isLoading;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            Purchase Price History
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Price basis"
              options={BASES.map((b) => ({ value: b.key, label: b.label }))}
              value={basis}
              onChange={(v) => setBasis(v as Basis)}
            />
            <Segmented
              label="Window"
              options={MONTH_PRESETS.map((p) => ({ value: String(p.months), label: p.label }))}
              value={String(months)}
              onChange={(v) => setMonths(Number(v) as Months)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!catalogItemId ? (
          <p className="text-sm text-muted-foreground">This item isn't linked to the item catalogue, so no price history is tracked.</p>
        ) : !companyId ? (
          <p className="text-sm text-muted-foreground">Select a company to see purchase prices.</p>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            {error.code === "42501"
              ? "You don't have access to purchase prices for this company."
              : `Couldn't load price history: ${error.message ?? "unknown error"}`}
          </p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !trend ? (
          <p className="text-sm text-muted-foreground">
            No {basis === "received" ? "received" : "ordered"} purchases in the last 12 months.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label="Last price"
                value={money(trend.last_price)}
                sub={trend.last_date ? `${trend.last_date} · ${trend.last_supplier ?? ""}` : undefined}
                highlight
              />
              <Stat
                label={`Weighted avg · ${months}M`}
                value={money(wap)}
                sub={qty ? `${Number(qty).toLocaleString()} ${trend.uom} bought` : "No purchases in window"}
              />
              <Stat label={`Min – max · ${months}M`} value={windowMin === null ? "—" : `${money(windowMin)}`} sub={windowMax === null ? undefined : `to ${money(windowMax)}`} />
              <Stat
                label="Last vs 12M avg"
                value={change === null ? "—" : `${change > 0 ? "+" : ""}${(change * 100).toFixed(1)}%`}
                sub={change === null ? undefined : change > 0 ? "Paying more than average" : change < 0 ? "Paying less than average" : "At average"}
                icon={change === null || change === 0 ? undefined : change > 0 ? TrendingUp : TrendingDown}
              />
            </div>

            {spark.length > 1 && (
              <div className="mt-4 rounded-lg border px-3 pt-2">
                <p className="text-[11px] text-muted-foreground">Net unit price ({trend.uom}) over the last {months} months</p>
                <Sparkline data={spark} height={56} fitToData />
              </div>
            )}

            {(otherUnits.length > 0 || trend.fx_missing > 0) && (
              <p className="mt-3 text-xs text-muted-foreground">
                {otherUnits.length > 0 && <>Also bought in: {otherUnits.join(", ")} (shown in the full report). </>}
                {trend.fx_missing > 0 && <>{trend.fx_missing} foreign-currency line(s) have no exchange rate and are left out of averages.</>}
              </p>
            )}

            <div className="mt-4 overflow-hidden rounded-lg border">
              <Table className="[&_td]:whitespace-nowrap [&_th]:whitespace-nowrap [&_td]:px-3 [&_th]:px-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>{basis === "received" ? "GRN / PO" : "PO #"}</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Net price</TableHead>
                    <TableHead className="text-right">Δ vs prev</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        No purchases in the last {months} month{months === 1 ? "" : "s"}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.slice(0, 50).map((r, i) => (
                      <TableRow key={`${r.doc_number}-${i}`}>
                        <TableCell className="whitespace-nowrap tabular-nums">{r.txn_date}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.doc_number}</div>
                          {basis === "received" && r.po_number && (
                            <div className="text-[11px] text-muted-foreground">{r.po_number}</div>
                          )}
                        </TableCell>
                        <TableCell>{r.supplier_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(r.quantity).toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.net_unit_price_base === null
                            ? `${r.txn_currency} ${Number(r.net_unit_price).toFixed(2)}`
                            : money(r.net_unit_price_base)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            r.chg_vs_prev !== null && r.chg_vs_prev > 0 && "text-destructive",
                            r.chg_vs_prev !== null && r.chg_vs_prev < 0 && "text-success",
                          )}
                        >
                          {r.chg_vs_prev === null ? "—" : `${r.chg_vs_prev > 0 ? "+" : ""}${(r.chg_vs_prev * 100).toFixed(1)}%`}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {catalogItemId && companyId && !error && canOpenReports && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link to={reportLink("PR-PRC-HIS-001")} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Full purchase history <ArrowUpRight className="h-3 w-3" />
            </Link>
            <Link to={reportLink("PR-PRC-TRD-001")} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              1/3/6/12-month trend <ArrowUpRight className="h-3 w-3" />
            </Link>
            <Link to={reportLink("PR-PRC-SUP-001")} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Compare suppliers <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-all",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  icon?: typeof TrendingUp;
}) {
  return (
    <div className={cn("rounded-lg p-3", highlight ? "bg-primary/10" : "bg-muted/50")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 text-base font-bold tabular-nums">
        {Icon && <Icon className="h-4 w-4" />}
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={sub}>{sub}</p>}
    </div>
  );
}
