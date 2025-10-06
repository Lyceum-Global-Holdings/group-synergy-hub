import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SupplierAnalytics, getGradeColor, getTrendIcon, getTrendColor } from "@/lib/supplierAnalytics";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface SupplierRankingTableProps {
  analytics: SupplierAnalytics[];
  onViewDetails?: (supplierId: string) => void;
}

export const SupplierRankingTable = ({ analytics, onViewDetails }: SupplierRankingTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Supplier Rankings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-center">Grade</TableHead>
                <TableHead className="text-right">Performance</TableHead>
                <TableHead className="text-right">Quality</TableHead>
                <TableHead className="text-right">Punctuality</TableHead>
                <TableHead className="text-right">Reliability</TableHead>
                <TableHead className="text-right">Deliveries</TableHead>
                <TableHead className="text-center">Trend</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No supplier analytics available
                  </TableCell>
                </TableRow>
              ) : (
                analytics.map((supplier, index) => (
                  <TableRow key={supplier.supplierId}>
                    <TableCell className="font-medium">#{index + 1}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{supplier.supplierName}</div>
                        <div className="text-xs text-muted-foreground">{supplier.supplierCode}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="outline" 
                        className={`${getGradeColor(supplier.performanceGrade)} font-bold`}
                      >
                        {supplier.performanceGrade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {supplier.avgPerformanceRate.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {supplier.avgQualityScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {supplier.avgPunctualityScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {supplier.reliabilityIndex.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {supplier.totalDeliveries}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={getTrendColor(supplier.trendDirection)}>
                        {getTrendIcon(supplier.trendDirection)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails?.(supplier.supplierId)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};