import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, AlertTriangle } from 'lucide-react';
import { useInventoryValuation } from '@/hooks/useInventoryValuation';
import { ValuationFilters } from '@/types/inventoryValuation';
import { Badge } from '@/components/ui/badge';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';

interface AgingAnalysisTabProps {
  filters: ValuationFilters;
}

const AGING_COLORS = {
  '0-30 days': 'hsl(var(--chart-1))',
  '31-90 days': 'hsl(var(--chart-2))',
  '91-180 days': 'hsl(var(--chart-3))',
  '181-365 days': 'hsl(var(--chart-4))',
  '365+ days': 'hsl(var(--chart-5))',
};

export function AgingAnalysisTab({ filters }: AgingAnalysisTabProps) {
  const { summary, valuationData, isLoading } = useInventoryValuation(filters);

  const agingData = Object.entries(summary.aging_breakdown).map(([bucket, value]) => ({
    name: bucket,
    value: value,
    count: valuationData.filter(item => item.aging_bucket === bucket).length,
  }));

  const deadStockItems = valuationData.filter(item => item.aging_bucket === '365+ days');
  const slowMovingItems = valuationData.filter(item => item.aging_bucket === '181-365 days');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fresh Stock (0-30 days)</p>
                <p className="text-2xl font-bold">LKR {summary.aging_breakdown['0-30 days'].toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {valuationData.filter(item => item.aging_bucket === '0-30 days').length} items
                </p>
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Slow Moving (181-365 days)</p>
                <p className="text-2xl font-bold">LKR {summary.slow_moving_value.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-1">{slowMovingItems.length} items</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dead Stock (365+ days)</p>
                <p className="text-2xl font-bold">LKR {summary.dead_stock_value.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-1">{deadStockItems.length} items</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aging Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Aging Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'value') return `LKR ${value.toFixed(2)}`;
                  return value;
                }}
              />
              <Legend />
              <Bar dataKey="value" name="Value (LKR)">
                {agingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={AGING_COLORS[entry.name as keyof typeof AGING_COLORS]} />
                ))}
              </Bar>
              <Bar dataKey="count" name="Item Count" fill="hsl(var(--muted))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Dead Stock Details */}
      {deadStockItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Dead Stock Items (365+ days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left text-sm font-medium">Item Code</th>
                    <th className="p-3 text-left text-sm font-medium">Item Name</th>
                    <th className="p-3 text-left text-sm font-medium">Category</th>
                    <th className="p-3 text-right text-sm font-medium">Quantity</th>
                    <th className="p-3 text-right text-sm font-medium">Value</th>
                    <th className="p-3 text-center text-sm font-medium">Days in Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {deadStockItems.slice(0, 10).map((item) => (
                    <tr key={item.item_id} className="border-b hover:bg-muted/50">
                      <td className="p-3 text-sm font-medium">{item.item_code}</td>
                      <td className="p-3 text-sm">{item.item_name}</td>
                      <td className="p-3 text-sm">{item.category}</td>
                      <td className="p-3 text-sm text-right">{item.quantity_on_hand.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right">LKR {item.total_value.toFixed(2)}</td>
                      <td className="p-3 text-sm text-center">
                        <Badge variant="destructive">{item.days_in_stock} days</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
