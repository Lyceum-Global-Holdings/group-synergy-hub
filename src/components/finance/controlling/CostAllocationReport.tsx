import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const allocationData = [
  { costCenter: "Production", directCosts: 300000, allocatedCosts: 50000 },
  { costCenter: "Sales & Marketing", directCosts: 150000, allocatedCosts: 30000 },
  { costCenter: "Administration", directCosts: 100000, allocatedCosts: 65000 },
  { costCenter: "R&D", directCosts: 60000, allocatedCosts: 15000 },
  { costCenter: "IT", directCosts: 40000, allocatedCosts: 42000 },
];

export function CostAllocationReport() {
  const pieData = allocationData.map((item) => ({
    name: item.costCenter,
    value: item.directCosts + item.allocatedCosts,
  }));

  const totals = allocationData.reduce(
    (acc, item) => ({
      directCosts: acc.directCosts + item.directCosts,
      allocatedCosts: acc.allocatedCosts + item.allocatedCosts,
    }),
    { directCosts: 0, allocatedCosts: 0 }
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Cost Allocation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cost Center</TableHead>
                <TableHead className="text-right">Direct Costs</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocationData.map((item) => (
                <TableRow key={item.costCenter}>
                  <TableCell className="font-medium">{item.costCenter}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.directCosts)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.allocatedCosts)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(item.directCosts + item.allocatedCosts)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.directCosts)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.allocatedCosts)}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totals.directCosts + totals.allocatedCosts)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
