import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupplierContext } from "@/contexts/SupplierContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function PortalInvoices() {
  const { activeSupplierId } = useSupplierContext();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeSupplierId) return;
    setLoading(true);
    supabase
      .from("einvoices")
      .select("id, invoice_number, status, direction, total_amount, currency, issue_date, peppol_message_id")
      .eq("supplier_id", activeSupplierId)
      .order("issue_date", { ascending: false })
      .limit(100)
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [activeSupplierId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">PEPPOL E-Invoices</h1>
      <Card>
        <CardHeader><CardTitle>Recent invoices</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>PEPPOL Msg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.invoice_number ?? r.id.slice(0, 8)}</TableCell>
                    <TableCell className="capitalize">{r.direction}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {r.total_amount != null ? `${r.currency ?? ""} ${Number(r.total_amount).toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell>{r.issue_date ? new Date(r.issue_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.peppol_message_id ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No invoices yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
