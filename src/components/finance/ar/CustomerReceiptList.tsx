import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import { useGLSettings } from "@/hooks/useGLSettings";

export function CustomerReceiptList() {
  const { selectedCompany } = useCompany();
  const { currencySymbol } = useGLSettings();

  const { data: receipts, isLoading } = useQuery({
    queryKey: ['customer-receipts', selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('customer_receipts').select('*, customer:customers(customer_name)').eq('company_id', selectedCompany?.id).order('receipt_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  if (isLoading) return <div className="text-center py-8">Loading...</div>;

  return (
    <Card>
      <CardHeader><CardTitle>Customer Receipts</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No receipts found</TableCell></TableRow>
            ) : receipts?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.receipt_number}</TableCell>
                <TableCell>{r.customer?.customer_name || '-'}</TableCell>
                <TableCell>{format(new Date(r.receipt_date), 'dd MMM yyyy')}</TableCell>
                <TableCell className="capitalize">{r.payment_method || '-'}</TableCell>
                <TableCell className="text-right">{currencySymbol} {r.total_amount?.toLocaleString()}</TableCell>
                <TableCell><Badge>{r.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
