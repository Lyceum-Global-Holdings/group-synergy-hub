import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendDataPoint } from "@/hooks/construction/useSiteReportAnalytics";
import { format, parseISO } from "date-fns";

interface TrendTableProps {
  data: TrendDataPoint[];
  isLoading?: boolean;
}

export function TrendTable({ data, isLoading }: TrendTableProps) {
  const formatNumber = (num: number) => num.toLocaleString();
  const formatCurrency = (num: number) => `₹${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Filter out days with no activity
  const activeData = data.filter(d => d.issued > 0 || d.returned > 0);

  // Calculate totals
  const totals = data.reduce(
    (acc, d) => ({
      issued: acc.issued + d.issued,
      returned: acc.returned + d.returned,
      issuedValue: acc.issuedValue + d.issuedValue,
      returnedValue: acc.returnedValue + d.returnedValue,
    }),
    { issued: 0, returned: 0, issuedValue: 0, returnedValue: 0 }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Trend Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Daily Trend Data</CardTitle>
        <span className="text-sm text-muted-foreground">
          {activeData.length} active days out of {data.length} total
        </span>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border max-h-[400px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Issued Qty</TableHead>
                <TableHead className="text-right">Returned Qty</TableHead>
                <TableHead className="text-right">Net Qty</TableHead>
                <TableHead className="text-right">Issued Value</TableHead>
                <TableHead className="text-right">Returned Value</TableHead>
                <TableHead className="text-right">Net Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No trend data available for the selected period
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {data.map((point) => {
                    const hasActivity = point.issued > 0 || point.returned > 0;
                    return (
                      <TableRow key={point.date} className={!hasActivity ? 'text-muted-foreground' : ''}>
                        <TableCell className="font-medium">
                          {format(parseISO(point.date), 'EEE, MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(point.issued)}</TableCell>
                        <TableCell className="text-right">{formatNumber(point.returned)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatNumber(point.issued - point.returned)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(point.issuedValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(point.returnedValue)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(point.issuedValue - point.returnedValue)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatNumber(totals.issued)}</TableCell>
                    <TableCell className="text-right">{formatNumber(totals.returned)}</TableCell>
                    <TableCell className="text-right">{formatNumber(totals.issued - totals.returned)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.issuedValue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.returnedValue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.issuedValue - totals.returnedValue)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
