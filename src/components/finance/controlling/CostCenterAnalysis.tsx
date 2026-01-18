import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

const sampleData = [
  { code: "CC-001", name: "Production", budget: 500000, actual: 450000 },
  { code: "CC-002", name: "Sales & Marketing", budget: 200000, actual: 180000 },
  { code: "CC-003", name: "Administration", budget: 150000, actual: 165000 },
  { code: "CC-004", name: "R&D", budget: 100000, actual: 75000 },
  { code: "CC-005", name: "IT", budget: 80000, actual: 82000 },
];

export function CostCenterAnalysis() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Center Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Cost Center</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="w-[200px]">Utilization</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleData.map((cc) => {
              const variance = cc.budget - cc.actual;
              const utilization = (cc.actual / cc.budget) * 100;
              
              return (
                <TableRow key={cc.code}>
                  <TableCell className="font-mono">{cc.code}</TableCell>
                  <TableCell className="font-medium">{cc.name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(cc.budget)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(cc.actual)}</TableCell>
                  <TableCell className={`text-right ${variance < 0 ? "text-destructive" : "text-green-600"}`}>
                    {formatCurrency(variance)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={Math.min(utilization, 100)} 
                        className={utilization > 100 ? "[&>div]:bg-destructive" : ""}
                      />
                      <span className="text-sm text-muted-foreground w-12">
                        {utilization.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
