import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

const reportData = {
  currentAssets: [
    { account: "Cash & Cash Equivalents", amount: 850000 },
    { account: "Accounts Receivable", amount: 420000 },
    { account: "Inventory", amount: 380000 },
    { account: "Prepaid Expenses", amount: 45000 },
  ],
  fixedAssets: [
    { account: "Property, Plant & Equipment", amount: 1200000 },
    { account: "Less: Accumulated Depreciation", amount: -350000 },
    { account: "Intangible Assets", amount: 150000 },
  ],
  currentLiabilities: [
    { account: "Accounts Payable", amount: 280000 },
    { account: "Accrued Expenses", amount: 95000 },
    { account: "Short-term Loans", amount: 200000 },
    { account: "Taxes Payable", amount: 65000 },
  ],
  longTermLiabilities: [
    { account: "Long-term Debt", amount: 500000 },
    { account: "Deferred Tax Liabilities", amount: 80000 },
  ],
  equity: [
    { account: "Common Stock", amount: 500000 },
    { account: "Retained Earnings", amount: 875000 },
    { account: "Current Year Earnings", amount: 100000 },
  ],
};

export function BalanceSheetReport() {
  const totalCurrentAssets = reportData.currentAssets.reduce((sum, item) => sum + item.amount, 0);
  const totalFixedAssets = reportData.fixedAssets.reduce((sum, item) => sum + item.amount, 0);
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const totalCurrentLiabilities = reportData.currentLiabilities.reduce((sum, item) => sum + item.amount, 0);
  const totalLongTermLiabilities = reportData.longTermLiabilities.reduce((sum, item) => sum + item.amount, 0);
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

  const totalEquity = reportData.equity.reduce((sum, item) => sum + item.amount, 0);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance Sheet</CardTitle>
        <p className="text-sm text-muted-foreground">As of December 31, 2024</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Assets */}
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={2} className="text-lg font-bold">Assets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={2} className="font-semibold">Current Assets</TableCell>
                </TableRow>
                {reportData.currentAssets.map((item) => (
                  <TableRow key={item.account}>
                    <TableCell className="pl-6">{item.account}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell className="pl-4">Total Current Assets</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalCurrentAssets)}</TableCell>
                </TableRow>

                <TableRow className="bg-muted/30">
                  <TableCell colSpan={2} className="font-semibold">Fixed Assets</TableCell>
                </TableRow>
                {reportData.fixedAssets.map((item) => (
                  <TableRow key={item.account}>
                    <TableCell className="pl-6">{item.account}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell className="pl-4">Total Fixed Assets</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalFixedAssets)}</TableCell>
                </TableRow>

                <TableRow className="bg-primary/20 font-bold text-lg">
                  <TableCell>Total Assets</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalAssets)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Liabilities & Equity */}
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={2} className="text-lg font-bold">Liabilities & Equity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={2} className="font-semibold">Current Liabilities</TableCell>
                </TableRow>
                {reportData.currentLiabilities.map((item) => (
                  <TableRow key={item.account}>
                    <TableCell className="pl-6">{item.account}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell className="pl-4">Total Current Liabilities</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalCurrentLiabilities)}</TableCell>
                </TableRow>

                <TableRow className="bg-muted/30">
                  <TableCell colSpan={2} className="font-semibold">Long-term Liabilities</TableCell>
                </TableRow>
                {reportData.longTermLiabilities.map((item) => (
                  <TableRow key={item.account}>
                    <TableCell className="pl-6">{item.account}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell className="pl-4">Total Long-term Liabilities</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalLongTermLiabilities)}</TableCell>
                </TableRow>

                <TableRow className="bg-muted/30">
                  <TableCell colSpan={2} className="font-semibold">Shareholders' Equity</TableCell>
                </TableRow>
                {reportData.equity.map((item) => (
                  <TableRow key={item.account}>
                    <TableCell className="pl-6">{item.account}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell className="pl-4">Total Equity</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalEquity)}</TableCell>
                </TableRow>

                <TableRow className="bg-primary/20 font-bold text-lg">
                  <TableCell>Total Liabilities & Equity</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalLiabilitiesAndEquity)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
