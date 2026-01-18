import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const sampleAccounts = [
  { id: "1", code: "4100", name: "Sales Revenue", values: Array(12).fill(50000) },
  { id: "2", code: "5100", name: "Cost of Goods Sold", values: Array(12).fill(25000) },
  { id: "3", code: "6100", name: "Salaries & Wages", values: Array(12).fill(15000) },
  { id: "4", code: "6200", name: "Rent Expense", values: Array(12).fill(5000) },
  { id: "5", code: "6300", name: "Utilities", values: Array(12).fill(2000) },
];

export function BudgetEntryGrid() {
  const calculateTotal = (values: number[]) => values.reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget Entry Grid - FY 2025</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background">Account</TableHead>
              {months.map((month) => (
                <TableHead key={month} className="text-right min-w-[100px]">
                  {month}
                </TableHead>
              ))}
              <TableHead className="text-right min-w-[120px]">Annual Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleAccounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="sticky left-0 bg-background font-medium">
                  <div>
                    <span className="text-muted-foreground">{account.code}</span>
                    <span className="ml-2">{account.name}</span>
                  </div>
                </TableCell>
                {account.values.map((value, index) => (
                  <TableCell key={index} className="p-1">
                    <Input
                      type="number"
                      defaultValue={value}
                      className="h-8 text-right"
                    />
                  </TableCell>
                ))}
                <TableCell className="text-right font-semibold">
                  {formatCurrency(calculateTotal(account.values))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
