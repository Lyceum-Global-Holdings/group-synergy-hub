import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SupplierAnalytics, getGradeColor } from "@/lib/supplierAnalytics";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface SupplierComparisonTabProps {
  analytics: SupplierAnalytics[];
}

export const SupplierComparisonTab = ({ analytics }: SupplierComparisonTabProps) => {
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);

  const handleSupplierSelect = (supplierId: string) => {
    if (selectedSuppliers.includes(supplierId)) {
      setSelectedSuppliers(selectedSuppliers.filter(id => id !== supplierId));
    } else if (selectedSuppliers.length < 5) {
      setSelectedSuppliers([...selectedSuppliers, supplierId]);
    }
  };

  const compareSuppliers = analytics.filter(a => selectedSuppliers.includes(a.supplierId));

  // Prepare radar chart data
  const radarData = [
    {
      metric: 'Performance',
      ...Object.fromEntries(compareSuppliers.map(s => [s.supplierCode, s.avgPerformanceRate]))
    },
    {
      metric: 'Quality',
      ...Object.fromEntries(compareSuppliers.map(s => [s.supplierCode, s.avgQualityScore]))
    },
    {
      metric: 'Punctuality',
      ...Object.fromEntries(compareSuppliers.map(s => [s.supplierCode, s.avgPunctualityScore]))
    },
    {
      metric: 'Consistency',
      ...Object.fromEntries(compareSuppliers.map(s => [s.supplierCode, s.consistencyScore]))
    },
    {
      metric: 'Reliability',
      ...Object.fromEntries(compareSuppliers.map(s => [s.supplierCode, s.reliabilityIndex]))
    },
  ];

  const colors = ['hsl(var(--primary))', 'hsl(142, 76%, 36%)', 'hsl(221, 83%, 53%)', 'hsl(262, 83%, 58%)', 'hsl(32, 95%, 44%)'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Suppliers to Compare</CardTitle>
          <CardDescription>Choose up to 5 suppliers for side-by-side comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {analytics.map(supplier => (
              <button
                key={supplier.supplierId}
                onClick={() => handleSupplierSelect(supplier.supplierId)}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  selectedSuppliers.includes(supplier.supplierId)
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
                disabled={!selectedSuppliers.includes(supplier.supplierId) && selectedSuppliers.length >= 5}
              >
                <div className="font-medium text-sm">{supplier.supplierCode}</div>
                <div className="text-xs text-muted-foreground truncate">{supplier.supplierName}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {compareSuppliers.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Multi-Metric Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid className="stroke-muted" />
                  <PolarAngleAxis 
                    dataKey="metric" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  {compareSuppliers.map((supplier, index) => (
                    <Radar
                      key={supplier.supplierId}
                      name={supplier.supplierCode}
                      dataKey={supplier.supplierCode}
                      stroke={colors[index]}
                      fill={colors[index]}
                      fillOpacity={0.2}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detailed Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      {compareSuppliers.map(supplier => (
                        <TableHead key={supplier.supplierId} className="text-center">
                          {supplier.supplierCode}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Performance Grade</TableCell>
                      {compareSuppliers.map(supplier => (
                        <TableCell key={supplier.supplierId} className="text-center">
                          <Badge variant="outline" className={getGradeColor(supplier.performanceGrade)}>
                            {supplier.performanceGrade}
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Avg Performance</TableCell>
                      {compareSuppliers.map(supplier => (
                        <TableCell key={supplier.supplierId} className="text-center">
                          {supplier.avgPerformanceRate.toFixed(1)}%
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Quality Score</TableCell>
                      {compareSuppliers.map(supplier => (
                        <TableCell key={supplier.supplierId} className="text-center">
                          {supplier.avgQualityScore.toFixed(1)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Punctuality Score</TableCell>
                      {compareSuppliers.map(supplier => (
                        <TableCell key={supplier.supplierId} className="text-center">
                          {supplier.avgPunctualityScore.toFixed(1)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Consistency</TableCell>
                      {compareSuppliers.map(supplier => (
                        <TableCell key={supplier.supplierId} className="text-center">
                          {supplier.consistencyScore.toFixed(1)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Reliability Index</TableCell>
                      {compareSuppliers.map(supplier => (
                        <TableCell key={supplier.supplierId} className="text-center">
                          {supplier.reliabilityIndex.toFixed(1)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Total Deliveries</TableCell>
                      {compareSuppliers.map(supplier => (
                        <TableCell key={supplier.supplierId} className="text-center">
                          {supplier.totalDeliveries}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Trend</TableCell>
                      {compareSuppliers.map(supplier => (
                        <TableCell key={supplier.supplierId} className="text-center">
                          {supplier.improvementRate > 0 ? '↗️' : supplier.improvementRate < 0 ? '↘️' : '→'} {supplier.improvementRate.toFixed(1)}%
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {compareSuppliers.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              Select suppliers above to begin comparison
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};