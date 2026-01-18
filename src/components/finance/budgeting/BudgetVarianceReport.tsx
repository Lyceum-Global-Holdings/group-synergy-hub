import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const sampleData = [
  { account: "Sales Revenue", budget: 600000, actual: 580000 },
  { account: "Cost of Goods Sold", budget: 300000, actual: 290000 },
  { account: "Salaries & Wages", budget: 180000, actual: 185000 },
  { account: "Rent Expense", budget: 60000, actual: 60000 },
  { account: "Utilities", budget: 24000, actual: 26500 },
  { account: "Marketing", budget: 36000, actual: 32000 },
];

export function BudgetVarianceReport() {
  const calculateVariance = (budget: number, actual: number) => {
    return actual - budget;
  };

  const calculateVariancePercent = (budget: number, actual: number) => {
    if (budget === 0) return 0;
    return ((actual - budget) / budget) * 100;
  };

  const getVarianceIcon = (variance: number, isExpense: boolean) => {
    if (variance === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    // For expenses, negative variance (under budget) is good
    // For revenue, positive variance (over budget) is good
    const isGood = isExpense ? variance < 0 : variance > 0;
    return isGood ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-destructive" />
    );
  };

  const totals = sampleData.reduce(
    (acc, row) => ({
      budget: acc.budget + row.budget,
      actual: acc.actual + row.actual,
    }),
    { budget: 0, actual: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget vs Actual Variance Report</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">Variance %</TableHead>
              <TableHead className="text-center">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleData.map((row, index) => {
              const variance = calculateVariance(row.budget, row.actual);
              const variancePercent = calculateVariancePercent(row.budget, row.actual);
              const isExpense = index > 0; // First row is revenue

              return (
                <TableRow key={row.account}>
                  <TableCell className="font-medium">{row.account}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.budget)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.actual)}</TableCell>
                  <TableCell className={`text-right ${variance < 0 ? "text-destructive" : variance > 0 ? "text-green-600" : ""}`}>
                    {formatCurrency(variance)}
                  </TableCell>
                  <TableCell className={`text-right ${variancePercent < 0 ? "text-destructive" : variancePercent > 0 ? "text-green-600" : ""}`}>
                    {variancePercent.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-center">
                    {getVarianceIcon(variance, isExpense)}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{formatCurrency(totals.budget)}</TableCell>
              <TableCell className="text-right">{formatCurrency(totals.actual)}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(calculateVariance(totals.budget, totals.actual))}
              </TableCell>
              <TableCell className="text-right">
                {calculateVariancePercent(totals.budget, totals.actual).toFixed(1)}%
              </TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
