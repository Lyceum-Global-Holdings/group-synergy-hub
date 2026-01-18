import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

const reportData = {
  operating: [
    { item: "Net Income", amount: 100000 },
    { item: "Depreciation & Amortization", amount: 65000 },
    { item: "Changes in Accounts Receivable", amount: -45000 },
    { item: "Changes in Inventory", amount: -30000 },
    { item: "Changes in Accounts Payable", amount: 25000 },
    { item: "Changes in Accrued Expenses", amount: 10000 },
  ],
  investing: [
    { item: "Purchase of Property & Equipment", amount: -150000 },
    { item: "Purchase of Investments", amount: -50000 },
    { item: "Proceeds from Sale of Assets", amount: 20000 },
  ],
  financing: [
    { item: "Proceeds from Long-term Debt", amount: 100000 },
    { item: "Repayment of Short-term Loans", amount: -75000 },
    { item: "Dividends Paid", amount: -40000 },
    { item: "Issuance of Common Stock", amount: 25000 },
  ],
};

export function CashFlowReport() {
  const netOperating = reportData.operating.reduce((sum, item) => sum + item.amount, 0);
  const netInvesting = reportData.investing.reduce((sum, item) => sum + item.amount, 0);
  const netFinancing = reportData.financing.reduce((sum, item) => sum + item.amount, 0);
  const netChange = netOperating + netInvesting + netFinancing;
  
  const beginningCash = 895000;
  const endingCash = beginningCash + netChange;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statement of Cash Flows</CardTitle>
        <p className="text-sm text-muted-foreground">For the period ending December 31, 2024</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Operating Activities */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={2} className="font-bold">Cash Flows from Operating Activities</TableCell>
            </TableRow>
            {reportData.operating.map((item) => (
              <TableRow key={item.item}>
                <TableCell className="pl-6">{item.item}</TableCell>
                <TableCell className={cn("text-right", item.amount < 0 ? "text-destructive" : "")}>
                  {formatCurrency(item.amount)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold bg-primary/10">
              <TableCell className="pl-4">Net Cash from Operating Activities</TableCell>
              <TableCell className={cn("text-right", netOperating < 0 ? "text-destructive" : "text-green-600")}>
                {formatCurrency(netOperating)}
              </TableCell>
            </TableRow>

            {/* Investing Activities */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={2} className="font-bold">Cash Flows from Investing Activities</TableCell>
            </TableRow>
            {reportData.investing.map((item) => (
              <TableRow key={item.item}>
                <TableCell className="pl-6">{item.item}</TableCell>
                <TableCell className={cn("text-right", item.amount < 0 ? "text-destructive" : "")}>
                  {formatCurrency(item.amount)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold bg-primary/10">
              <TableCell className="pl-4">Net Cash from Investing Activities</TableCell>
              <TableCell className={cn("text-right", netInvesting < 0 ? "text-destructive" : "text-green-600")}>
                {formatCurrency(netInvesting)}
              </TableCell>
            </TableRow>

            {/* Financing Activities */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={2} className="font-bold">Cash Flows from Financing Activities</TableCell>
            </TableRow>
            {reportData.financing.map((item) => (
              <TableRow key={item.item}>
                <TableCell className="pl-6">{item.item}</TableCell>
                <TableCell className={cn("text-right", item.amount < 0 ? "text-destructive" : "")}>
                  {formatCurrency(item.amount)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold bg-primary/10">
              <TableCell className="pl-4">Net Cash from Financing Activities</TableCell>
              <TableCell className={cn("text-right", netFinancing < 0 ? "text-destructive" : "text-green-600")}>
                {formatCurrency(netFinancing)}
              </TableCell>
            </TableRow>

            {/* Summary */}
            <TableRow className="bg-primary/20 font-bold">
              <TableCell>Net Change in Cash</TableCell>
              <TableCell className={cn("text-right", netChange < 0 ? "text-destructive" : "text-green-600")}>
                {formatCurrency(netChange)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Beginning Cash Balance</TableCell>
              <TableCell className="text-right">{formatCurrency(beginningCash)}</TableCell>
            </TableRow>
            <TableRow className="bg-primary/20 font-bold text-lg">
              <TableCell>Ending Cash Balance</TableCell>
              <TableCell className="text-right text-green-600">{formatCurrency(endingCash)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
