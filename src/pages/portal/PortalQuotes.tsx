import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupplierContext } from "@/contexts/SupplierContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function PortalQuotes() {
  const { activeSupplierId } = useSupplierContext();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeSupplierId) return;
    setLoading(true);
    supabase
      .from("supplier_quotes")
      .select("id, quote_number, status, total_quoted_amount, currency, validity_period, created_at")
      .eq("supplier_id", activeSupplierId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [activeSupplierId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Quotes</h1>
      <Card>
        <CardHeader><CardTitle>Submitted quotes</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.quote_number ?? r.id.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{r.status ?? "draft"}</Badge></TableCell>
                    <TableCell className="text-right">
                      {r.total_quoted_amount != null ? `${r.currency ?? ""} ${Number(r.total_quoted_amount).toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell>{r.validity_period ? new Date(r.validity_period).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No quotes yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
