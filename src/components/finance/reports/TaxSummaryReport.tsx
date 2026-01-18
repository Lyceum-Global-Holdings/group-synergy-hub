import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function TaxSummaryReport() {
  const { selectedCompany } = useCompany();

  const { data: taxCodes, isLoading } = useQuery({
    queryKey: ["tax-summary", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_codes")
        .select("*")
        .eq("company_id", selectedCompany?.id)
        .eq("is_active", true)
        .order("tax_code");

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  // Sample summary data - in production, this would come from actual transactions
  const taxSummary = taxCodes?.map((code) => ({
    ...code,
    taxableAmount: Math.random() * 500000 + 100000,
    taxCollected: Math.random() * 50000 + 10000,
    taxPaid: Math.random() * 30000 + 5000,
  })) || [];

  const totals = taxSummary.reduce(
    (acc, item) => ({
      taxableAmount: acc.taxableAmount + item.taxableAmount,
      taxCollected: acc.taxCollected + item.taxCollected,
      taxPaid: acc.taxPaid + item.taxPaid,
    }),
    { taxableAmount: 0, taxCollected: 0, taxPaid: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax Summary Report</CardTitle>
        <p className="text-sm text-muted-foreground">For the period ending December 31, 2024</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tax Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead className="text-right">Taxable Amount</TableHead>
              <TableHead className="text-right">Tax Collected</TableHead>
              <TableHead className="text-right">Tax Paid</TableHead>
              <TableHead className="text-right">Net Payable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taxSummary.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No tax codes configured
                </TableCell>
              </TableRow>
            ) : (
              <>
                {taxSummary.map((tax) => (
                  <TableRow key={tax.id}>
                    <TableCell className="font-mono">{tax.tax_code}</TableCell>
                    <TableCell>{tax.tax_name}</TableCell>
                    <TableCell>{Number(tax.tax_rate)}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(tax.taxableAmount)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(tax.taxCollected)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(tax.taxPaid)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(tax.taxCollected - tax.taxPaid)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.taxableAmount)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(totals.taxCollected)}</TableCell>
                  <TableCell className="text-right text-destructive">{formatCurrency(totals.taxPaid)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.taxCollected - totals.taxPaid)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
