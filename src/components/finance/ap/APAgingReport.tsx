import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useGLSettings } from "@/hooks/useGLSettings";
import { differenceInDays } from "date-fns";

export function APAgingReport() {
  const { selectedCompany } = useCompany();
  const { currencySymbol } = useGLSettings();

  const { data: invoices } = useQuery({
    queryKey: ['ap-aging', selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*, supplier:suppliers(supplier_name)')
        .eq('company_id', selectedCompany?.id)
        .in('status', ['posted', 'partially_paid'])
        .order('supplier_id');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const today = new Date();
  const aging = invoices?.reduce((acc: any, inv: any) => {
    const supplierId = inv.supplier_id;
    const supplierName = inv.supplier?.supplier_name || 'Unknown';
    const daysOverdue = differenceInDays(today, new Date(inv.due_date));
    const outstanding = inv.gross_amount - (inv.amount_paid || 0);
    
    if (!acc[supplierId]) {
      acc[supplierId] = { name: supplierName, current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };
    }
    
    if (daysOverdue <= 0) acc[supplierId].current += outstanding;
    else if (daysOverdue <= 30) acc[supplierId].days30 += outstanding;
    else if (daysOverdue <= 60) acc[supplierId].days60 += outstanding;
    else if (daysOverdue <= 90) acc[supplierId].days90 += outstanding;
    else acc[supplierId].over90 += outstanding;
    acc[supplierId].total += outstanding;
    
    return acc;
  }, {});

  interface AgingTotals { current: number; days30: number; days60: number; days90: number; over90: number; total: number; }
  const agingData = Object.values(aging || {}) as Array<AgingTotals & { name: string }>;
  const totals = agingData.reduce<AgingTotals>((t, a) => ({
    current: t.current + a.current, days30: t.days30 + a.days30,
    days60: t.days60 + a.days60, days90: t.days90 + a.days90,
    over90: t.over90 + a.over90, total: t.total + a.total
  }), { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 });

  const fmt = (n: number) => n > 0 ? `${currencySymbol} ${n.toLocaleString()}` : '-';

  return (
    <Card>
      <CardHeader><CardTitle>Accounts Payable Aging Summary</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">1-30 Days</TableHead>
              <TableHead className="text-right">31-60 Days</TableHead>
              <TableHead className="text-right">61-90 Days</TableHead>
              <TableHead className="text-right">90+ Days</TableHead>
              <TableHead className="text-right font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agingData.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No outstanding payables</TableCell></TableRow>
            ) : agingData.map((a: any, i) => (
              <TableRow key={i}>
                <TableCell>{a.name}</TableCell>
                <TableCell className="text-right">{fmt(a.current)}</TableCell>
                <TableCell className="text-right">{fmt(a.days30)}</TableCell>
                <TableCell className="text-right">{fmt(a.days60)}</TableCell>
                <TableCell className="text-right">{fmt(a.days90)}</TableCell>
                <TableCell className="text-right text-destructive">{fmt(a.over90)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(a.total)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{fmt(totals.current)}</TableCell>
              <TableCell className="text-right">{fmt(totals.days30)}</TableCell>
              <TableCell className="text-right">{fmt(totals.days60)}</TableCell>
              <TableCell className="text-right">{fmt(totals.days90)}</TableCell>
              <TableCell className="text-right text-destructive">{fmt(totals.over90)}</TableCell>
              <TableCell className="text-right">{fmt(totals.total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
