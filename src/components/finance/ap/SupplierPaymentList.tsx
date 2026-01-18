import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import { useGLSettings } from "@/hooks/useGLSettings";

export function SupplierPaymentList() {
  const { selectedCompany } = useCompany();
  const { currencySymbol } = useGLSettings();

  const { data: payments, isLoading } = useQuery({
    queryKey: ['supplier-payments', selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_payments')
        .select('*, supplier:suppliers(supplier_name)')
        .eq('company_id', selectedCompany?.id)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  if (isLoading) return <div className="text-center py-8">Loading payments...</div>;

  return (
    <Card>
      <CardHeader><CardTitle>Supplier Payments</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No payments found</TableCell></TableRow>
            ) : payments?.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.payment_number}</TableCell>
                <TableCell>{p.supplier?.supplier_name || '-'}</TableCell>
                <TableCell>{format(new Date(p.payment_date), 'dd MMM yyyy')}</TableCell>
                <TableCell className="capitalize">{p.payment_method || '-'}</TableCell>
                <TableCell className="text-right">{currencySymbol} {p.total_amount?.toLocaleString()}</TableCell>
                <TableCell><Badge>{p.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
