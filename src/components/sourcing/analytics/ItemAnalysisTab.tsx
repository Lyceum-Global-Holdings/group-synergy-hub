import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierEvaluation } from "@/types/supplierEvaluation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, AlertCircle, CheckCircle } from "lucide-react";

interface ItemAnalysisTabProps {
  evaluations: SupplierEvaluation[];
}

interface ItemMetrics {
  itemCode: string;
  itemName: string;
  supplierCount: number;
  totalDeliveries: number;
  avgQuality: number;
  avgPunctuality: number;
  issueCount: number;
}

export const ItemAnalysisTab = ({ evaluations }: ItemAnalysisTabProps) => {
  // Aggregate item-level metrics
  const itemMetricsMap = new Map<string, ItemMetrics>();

  evaluations.forEach(evaluation => {
    evaluation.entries?.forEach(entry => {
      if (!entry.warehouse_item_id || !entry.warehouse_item) return;

      const itemId = entry.warehouse_item_id;
      if (!itemMetricsMap.has(itemId)) {
        itemMetricsMap.set(itemId, {
          itemCode: entry.warehouse_item.item_code,
          itemName: entry.warehouse_item.name,
          supplierCount: new Set([evaluation.supplier_id]).size,
          totalDeliveries: 0,
          avgQuality: 0,
          avgPunctuality: 0,
          issueCount: 0,
        });
      }

      const metrics = itemMetricsMap.get(itemId)!;
      metrics.totalDeliveries++;
      metrics.avgQuality += entry.quality_score;
      metrics.avgPunctuality += entry.punctuality_score;
      
      // Count issues (failed deliveries)
      if (entry.failed_returned) {
        metrics.issueCount++;
      }
    });
  });

  // Calculate averages
  const itemMetrics = Array.from(itemMetricsMap.values()).map(metrics => ({
    ...metrics,
    avgQuality: metrics.totalDeliveries > 0 ? metrics.avgQuality / metrics.totalDeliveries : 0,
    avgPunctuality: metrics.totalDeliveries > 0 ? metrics.avgPunctuality / metrics.totalDeliveries : 0,
  }));

  // Sort by issue count (most issues first)
  itemMetrics.sort((a, b) => b.issueCount - a.issueCount);

  const singleSourceItems = itemMetrics.filter(m => m.supplierCount === 1);
  const problematicItems = itemMetrics.filter(m => m.issueCount > 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Items Tracked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{itemMetrics.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Single Source Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{singleSourceItems.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Risk of supply disruption</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Items with Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{problematicItems.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Quality or delivery problems</p>
          </CardContent>
        </Card>
      </div>

      {/* Item Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Item-Level Analysis</CardTitle>
          <CardDescription>Performance metrics by item across all suppliers</CardDescription>
        </CardHeader>
        <CardContent>
          {itemMetrics.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-center">Suppliers</TableHead>
                    <TableHead className="text-center">Deliveries</TableHead>
                    <TableHead className="text-right">Avg Quality</TableHead>
                    <TableHead className="text-right">Avg Punctuality</TableHead>
                    <TableHead className="text-center">Issues</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemMetrics.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.itemCode}</TableCell>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell className="text-center">
                        {item.supplierCount === 1 ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-200">
                            {item.supplierCount}
                          </Badge>
                        ) : (
                          <span>{item.supplierCount}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.totalDeliveries}</TableCell>
                      <TableCell className="text-right">{item.avgQuality.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{item.avgPunctuality.toFixed(1)}</TableCell>
                      <TableCell className="text-center">
                        {item.issueCount > 0 ? (
                          <Badge variant="outline" className="text-red-600 border-red-200">
                            {item.issueCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.issueCount > 0 ? (
                          <AlertCircle className="h-4 w-4 text-red-600 mx-auto" />
                        ) : item.supplierCount === 1 ? (
                          <AlertCircle className="h-4 w-4 text-orange-600 mx-auto" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No item data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};