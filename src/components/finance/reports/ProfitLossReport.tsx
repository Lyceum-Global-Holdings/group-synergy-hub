import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

const reportData = {
  revenue: [
    { account: "Sales Revenue", amount: 1500000 },
    { account: "Service Revenue", amount: 350000 },
    { account: "Other Income", amount: 50000 },
  ],
  cogs: [
    { account: "Cost of Goods Sold", amount: 750000 },
    { account: "Direct Labor", amount: 150000 },
    { account: "Manufacturing Overhead", amount: 100000 },
  ],
  operatingExpenses: [
    { account: "Salaries & Wages", amount: 280000 },
    { account: "Rent Expense", amount: 120000 },
    { account: "Utilities", amount: 45000 },
    { account: "Marketing & Advertising", amount: 85000 },
    { account: "Depreciation", amount: 65000 },
    { account: "Insurance", amount: 35000 },
    { account: "Professional Fees", amount: 25000 },
    { account: "Office Supplies", amount: 15000 },
  ],
  otherExpenses: [
    { account: "Interest Expense", amount: 25000 },
    { account: "Bank Charges", amount: 5000 },
  ],
};

export function ProfitLossReport() {
  const totalRevenue = reportData.revenue.reduce((sum, item) => sum + item.amount, 0);
  const totalCogs = reportData.cogs.reduce((sum, item) => sum + item.amount, 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalOperatingExpenses = reportData.operatingExpenses.reduce((sum, item) => sum + item.amount, 0);
  const operatingIncome = grossProfit - totalOperatingExpenses;
  const totalOtherExpenses = reportData.otherExpenses.reduce((sum, item) => sum + item.amount, 0);
  const netIncome = operatingIncome - totalOtherExpenses;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profit & Loss Statement</CardTitle>
        <p className="text-sm text-muted-foreground">For the period ending December 31, 2024</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Revenue Section */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={3} className="font-bold">Revenue</TableCell>
            </TableRow>
            {reportData.revenue.map((item) => (
              <TableRow key={item.account}>
                <TableCell className="pl-8">{item.account}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell className="pl-4">Total Revenue</TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right">{formatCurrency(totalRevenue)}</TableCell>
            </TableRow>

            {/* COGS Section */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={3} className="font-bold">Cost of Goods Sold</TableCell>
            </TableRow>
            {reportData.cogs.map((item) => (
              <TableRow key={item.account}>
                <TableCell className="pl-8">{item.account}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell className="pl-4">Total COGS</TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right">({formatCurrency(totalCogs)})</TableCell>
            </TableRow>

            {/* Gross Profit */}
            <TableRow className="bg-primary/10 font-bold">
              <TableCell>Gross Profit</TableCell>
              <TableCell></TableCell>
              <TableCell className={cn("text-right", grossProfit >= 0 ? "text-green-600" : "text-destructive")}>
                {formatCurrency(grossProfit)}
              </TableCell>
            </TableRow>

            {/* Operating Expenses */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={3} className="font-bold">Operating Expenses</TableCell>
            </TableRow>
            {reportData.operatingExpenses.map((item) => (
              <TableRow key={item.account}>
                <TableCell className="pl-8">{item.account}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell className="pl-4">Total Operating Expenses</TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right">({formatCurrency(totalOperatingExpenses)})</TableCell>
            </TableRow>

            {/* Operating Income */}
            <TableRow className="bg-primary/10 font-bold">
              <TableCell>Operating Income</TableCell>
              <TableCell></TableCell>
              <TableCell className={cn("text-right", operatingIncome >= 0 ? "text-green-600" : "text-destructive")}>
                {formatCurrency(operatingIncome)}
              </TableCell>
            </TableRow>

            {/* Other Expenses */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={3} className="font-bold">Other Expenses</TableCell>
            </TableRow>
            {reportData.otherExpenses.map((item) => (
              <TableRow key={item.account}>
                <TableCell className="pl-8">{item.account}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell className="pl-4">Total Other Expenses</TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right">({formatCurrency(totalOtherExpenses)})</TableCell>
            </TableRow>

            {/* Net Income */}
            <TableRow className="bg-primary/20 font-bold text-lg">
              <TableCell>Net Income</TableCell>
              <TableCell></TableCell>
              <TableCell className={cn("text-right", netIncome >= 0 ? "text-green-600" : "text-destructive")}>
                {formatCurrency(netIncome)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
