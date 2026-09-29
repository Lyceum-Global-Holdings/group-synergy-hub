import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import { useGLSettings } from "@/hooks/useGLSettings";
import { Button } from "@/components/ui/button";
import { POSTABLE_SUPPLIER, usePostInvoice } from "@/hooks/finance/useFinancePosting";

// Where the invoice came from, and how it matched its PO and goods receipt.
const SOURCE: Record<string, string> = { portal: 'Supplier portal', peppol: 'PEPPOL e-invoice' };
const MATCH: Record<string, { label: string; className: string }> = {
  matched: { label: 'Matched', className: 'bg-emerald-100 text-emerald-800' },
  auto_matched: { label: 'Matched', className: 'bg-emerald-100 text-emerald-800' },
  partial: { label: 'Partly matched', className: 'bg-amber-100 text-amber-800' },
  mismatch: { label: 'Mismatch', className: 'bg-red-100 text-red-800' },
  exception: { label: 'Exception', className: 'bg-red-100 text-red-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
};

export function SupplierInvoiceList() {
  const { selectedCompany } = useCompany();
  const { currencySymbol } = useGLSettings();
  const post = usePostInvoice("supplier");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['supplier-invoices', selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*, supplier:suppliers(name)')
        .eq('company_id', selectedCompany?.id)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'secondary', pending_approval: 'warning', approved: 'default',
      posted: 'default', partially_paid: 'warning', paid: 'success', cancelled: 'destructive'
    };
    return <Badge variant={variants[status] as any}>{status.replace('_', ' ')}</Badge>;
  };

  if (isLoading) return <div className="text-center py-8">Loading invoices...</div>;

  return (
    <Card>
      <CardHeader><CardTitle>Supplier Invoices</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices?.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No invoices found</TableCell></TableRow>
            ) : invoices?.map((inv: any) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">
                  {inv.invoice_number}
                  {SOURCE[inv.source] && <div className="text-xs font-normal text-muted-foreground">{SOURCE[inv.source]}</div>}
                </TableCell>
                <TableCell>
                  {inv.supplier?.name || (inv.source === 'peppol' ? <span className="text-amber-700">Supplier not recognised</span> : '-')}
                </TableCell>
                <TableCell>{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</TableCell>
                <TableCell>{format(new Date(inv.due_date), 'dd MMM yyyy')}</TableCell>
                <TableCell className="text-right">{currencySymbol} {inv.gross_amount?.toLocaleString()}</TableCell>
                <TableCell>
                  {MATCH[inv.three_way_match_status]
                    ? <Badge variant="outline" className={MATCH[inv.three_way_match_status].className}>{MATCH[inv.three_way_match_status].label}</Badge>
                    : <span className="text-xs text-muted-foreground">{inv.po_id ? 'Not checked yet' : 'No PO'}</span>}
                </TableCell>
                <TableCell>
                  {getStatusBadge(inv.status)}
                  {Number(inv.amount_paid) > 0 && inv.status !== 'paid' && (
                    <div className="text-xs text-muted-foreground">Paid {currencySymbol} {Number(inv.amount_paid).toLocaleString()}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {POSTABLE_SUPPLIER.includes(inv.status) && (
                    <Button size="sm" variant="outline" onClick={() => post.mutate(inv.id)} disabled={post.isPending}>Post</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
