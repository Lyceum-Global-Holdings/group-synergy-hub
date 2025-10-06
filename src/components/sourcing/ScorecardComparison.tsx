import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierEvaluation } from "@/types/supplierEvaluation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ScorecardComparisonProps {
  evaluations: SupplierEvaluation[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export const ScorecardComparison = ({ evaluations, onRemove, onClear }: ScorecardComparisonProps) => {
  if (evaluations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Comparison View</CardTitle>
            <CardDescription>
              Compare {evaluations.length} selected evaluation{evaluations.length > 1 ? 's' : ''}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={onClear}>
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                {evaluations.map(evaluation => (
                  <TableHead key={evaluation.id} className="text-center min-w-[150px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex-1 truncate">{evaluation.supplier?.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(evaluation.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground font-normal">
                      {evaluation.evaluation_number}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Product</TableCell>
                {evaluations.map(evaluation => (
                  <TableCell key={evaluation.id} className="text-center">
                    <div>{evaluation.product_name}</div>
                    {evaluation.warehouse_item && (
                      <div className="text-xs text-muted-foreground">
                        {evaluation.warehouse_item.item_code}
                      </div>
                    )}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Performance Rate</TableCell>
                {evaluations.map(evaluation => (
                  <TableCell key={evaluation.id} className="text-center">
                    <Badge
                      variant="outline"
                      className={
                        evaluation.performance_rate >= 85 ? 'bg-green-50 text-green-700 border-green-200' :
                        evaluation.performance_rate >= 70 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        evaluation.performance_rate >= 55 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }
                    >
                      {evaluation.performance_rate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Total Deliveries</TableCell>
                {evaluations.map(evaluation => (
                  <TableCell key={evaluation.id} className="text-center">
                    {evaluation.total_deliveries}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Points Achieved</TableCell>
                {evaluations.map(evaluation => (
                  <TableCell key={evaluation.id} className="text-center">
                    {evaluation.total_points_achieved} / {evaluation.total_possible_points}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Status</TableCell>
                {evaluations.map(evaluation => (
                  <TableCell key={evaluation.id} className="text-center">
                    <Badge variant="outline">
                      {evaluation.status}
                    </Badge>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};