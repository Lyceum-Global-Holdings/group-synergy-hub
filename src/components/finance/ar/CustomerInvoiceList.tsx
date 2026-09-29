import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import { useGLSettings } from "@/hooks/useGLSettings";
import { Button } from "@/components/ui/button";
import { POSTABLE_CUSTOMER, usePostInvoice } from "@/hooks/finance/useFinancePosting";

export function CustomerInvoiceList() {
  const { selectedCompany } = useCompany();
  const { currencySymbol } = useGLSettings();
  const post = usePostInvoice("customer");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['customer-invoices', selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('customer_invoices').select('*, customer:customers(customer_name)').eq('company_id', selectedCompany?.id).order('invoice_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  if (isLoading) return <div className="text-center py-8">Loading...</div>;

  return (
    <Card>
      <CardHeader><CardTitle>Customer Invoices</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No invoices found</TableCell></TableRow>
            ) : invoices?.map((inv: any) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                <TableCell>{inv.customer?.customer_name || '-'}</TableCell>
                <TableCell>{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</TableCell>
                <TableCell>{format(new Date(inv.due_date), 'dd MMM yyyy')}</TableCell>
                <TableCell className="text-right">{currencySymbol} {inv.gross_amount?.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge>{String(inv.status).replace('_', ' ')}</Badge>
                  {Number(inv.amount_received) > 0 && inv.status !== 'paid' && (
                    <div className="text-xs text-muted-foreground">Received {currencySymbol} {Number(inv.amount_received).toLocaleString()}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {POSTABLE_CUSTOMER.includes(inv.status) && (
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
