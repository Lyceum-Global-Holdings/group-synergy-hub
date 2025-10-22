import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Package, TrendingDown, AlertTriangle, BarChart3, PieChart } from 'lucide-react';
import { useInventoryValuation } from '@/hooks/useInventoryValuation';
import { ValuationFilters } from '@/types/inventoryValuation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface ValuationDashboardProps {
  filters: ValuationFilters;
  onFiltersChange: (filters: ValuationFilters) => void;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function ValuationDashboard({ filters, onFiltersChange }: ValuationDashboardProps) {
  const { summary, valuationData, isLoading } = useInventoryValuation(filters);

  const categoryData = valuationData.reduce((acc, item) => {
    const existing = acc.find(d => d.name === item.category);
    if (existing) {
      existing.value += item.total_value;
    } else {
      acc.push({ name: item.category, value: item.total_value });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const agingData = Object.entries(summary.aging_breakdown).map(([bucket, value]) => ({
    name: bucket,
    value: value,
  }));

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
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Valuation Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Valuation Date</Label>
            <Input
              type="date"
              value={filters.valuationDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => onFiltersChange({ ...filters, valuationDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Item Type</Label>
            <Select
              value={filters.itemTypes?.join(',') || 'all'}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  itemTypes: value === 'all' ? undefined : [value as any],
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="raw_material">Raw Materials</SelectItem>
                <SelectItem value="finished_good">Finished Goods</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Inventory Value</p>
                <p className="text-2xl font-bold">LKR {summary.total_inventory_value.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{summary.total_items}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Slow Moving Stock</p>
                <p className="text-2xl font-bold">LKR {summary.slow_moving_value.toFixed(2)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dead Stock</p>
                <p className="text-2xl font-bold">LKR {summary.dead_stock_value.toFixed(2)}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Value by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${((entry.value / summary.total_inventory_value) * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `LKR ${value.toFixed(2)}`} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Aging Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => `LKR ${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="value" fill="hsl(var(--primary))" name="Value" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
