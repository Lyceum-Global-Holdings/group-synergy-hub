import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History } from "lucide-react";
import { format } from "date-fns";

interface PriceHistoryRow {
  id: string;
  grn_id: string | null;
  grn_number: string | null;
  grn_date: string | null;
  po_number: string | null;
  supplier_name: string | null;
  unit_price: number;
  quantity_received: number;
  total_cost: number;
  received_at: string;
}

interface Props {
  catalogItemId: string | null;
  warehouseItemId: string | null;
}

async function fetchPriceHistory(
  catalogItemId: string | null,
  warehouseItemId: string | null,
): Promise<PriceHistoryRow[]> {
  if (!catalogItemId && !warehouseItemId) return [];
  let query = supabase
    .from("warehouse_item_price_history")
    .select(
      "id, grn_id, grn_number, grn_date, po_number, supplier_name, unit_price, quantity_received, total_cost, received_at",
    )
    .order("received_at", { ascending: false })
    .limit(50);

  if (catalogItemId && warehouseItemId) {
    query = query.or(
      `catalog_item_id.eq.${catalogItemId},warehouse_item_id.eq.${warehouseItemId}`,
    );
  } else if (catalogItemId) {
    query = query.eq("catalog_item_id", catalogItemId);
  } else if (warehouseItemId) {
    query = query.eq("warehouse_item_id", warehouseItemId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PriceHistoryRow[];
}

export function PurchasePriceHistory({ catalogItemId, warehouseItemId }: Props) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["item-price-history", catalogItemId, warehouseItemId],
    queryFn: () => fetchPriceHistory(catalogItemId, warehouseItemId),
    enabled: !!(catalogItemId || warehouseItemId),
  });

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const last = rows[0];
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const recent = rows.filter((r) => new Date(r.received_at).getTime() >= cutoff && r.unit_price > 0);
    if (!recent.length) {
      return { last: last.unit_price, avg: last.unit_price, min: last.unit_price, max: last.unit_price };
    }
    const prices = recent.map((r) => Number(r.unit_price));
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    return {
      last: last.unit_price,
      avg,
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          Purchase Price History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !rows.length ? (
          <p className="text-sm text-muted-foreground">No purchase history yet.</p>
        ) : (
          <>
            {stats && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                <Stat label="Last Price" value={stats.last} highlight />
                <Stat label="Avg (12 mo)" value={stats.avg} />
                <Stat label="Min (12 mo)" value={stats.min} />
                <Stat label="Max (12 mo)" value={stats.max} />
              </div>
            )}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GRN Date</TableHead>
                    <TableHead>GRN #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>PO #</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.grn_date
                          ? format(new Date(r.grn_date), "MMM dd, yyyy")
                          : format(new Date(r.received_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">{r.grn_number || "-"}</TableCell>
                      <TableCell>{r.supplier_name || "-"}</TableCell>
                      <TableCell className="text-right">{Number(r.quantity_received).toLocaleString()}</TableCell>
                      <TableCell className="text-right">LKR {Number(r.unit_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right">LKR {Number(r.total_cost).toFixed(2)}</TableCell>
                      <TableCell>{r.po_number || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`text-center p-3 rounded-lg ${highlight ? "bg-primary/10" : "bg-muted/50"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">LKR {Number(value).toFixed(2)}</p>
    </div>
  );
}
