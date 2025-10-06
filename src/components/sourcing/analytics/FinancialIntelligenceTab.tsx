import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierAnalytics } from "@/lib/supplierAnalytics";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { DollarSign, TrendingUp, Award } from "lucide-react";

interface FinancialIntelligenceTabProps {
  analytics: SupplierAnalytics[];
}

export const FinancialIntelligenceTab = ({ analytics }: FinancialIntelligenceTabProps) => {
  // Calculate financial metrics (using delivery count as proxy for spend)
  const totalDeliveries = analytics.reduce((sum, a) => sum + a.totalDeliveries, 0);
  
  const spendBySupplier = analytics.map(supplier => ({
    name: supplier.supplierCode,
    fullName: supplier.supplierName,
    value: supplier.totalDeliveries,
    performance: supplier.avgPerformanceRate,
  })).sort((a, b) => b.value - a.value);

  const top5Suppliers = spendBySupplier.slice(0, 5);
  
  const COLORS = ['hsl(var(--primary))', 'hsl(142, 76%, 36%)', 'hsl(221, 83%, 53%)', 'hsl(262, 83%, 58%)', 'hsl(32, 95%, 44%)'];

  // Calculate value efficiency (performance per delivery)
  const efficiencyData = analytics.map(supplier => ({
    name: supplier.supplierCode,
    efficiency: supplier.avgPerformanceRate / Math.max(1, supplier.totalDeliveries / 10),
    deliveries: supplier.totalDeliveries,
    performance: supplier.avgPerformanceRate,
  })).sort((a, b) => b.efficiency - a.efficiency).slice(0, 10);

  // Best value suppliers (high performance, high volume)
  const bestValue = analytics
    .filter(s => s.totalDeliveries >= 5)
    .map(s => ({
      ...s,
      valueScore: (s.avgPerformanceRate * 0.7) + (Math.min(s.totalDeliveries / 20, 1) * 30)
    }))
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeliveries}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all suppliers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.length}</div>
            <p className="text-xs text-muted-foreground mt-1">With evaluation data</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Performance</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analytics.reduce((sum, a) => sum + a.avgPerformanceRate, 0) / analytics.length).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Weighted average</p>
          </CardContent>
        </Card>
      </div>

      {/* Spend Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Delivery Distribution by Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={top5Suppliers}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {top5Suppliers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance vs Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={efficiencyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  className="text-xs"
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  className="text-xs"
                />
                <Tooltip />
                <Bar dataKey="performance" fill="hsl(var(--primary))" name="Performance %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Best Value Suppliers */}
      <Card>
        <CardHeader>
          <CardTitle>Best Value Suppliers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {bestValue.map((supplier, index) => (
              <div key={supplier.supplierId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-muted-foreground">#{index + 1}</div>
                  <div>
                    <div className="font-medium">{supplier.supplierName}</div>
                    <div className="text-sm text-muted-foreground">{supplier.supplierCode}</div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm font-medium">{supplier.avgPerformanceRate.toFixed(1)}% Performance</div>
                  <div className="text-xs text-muted-foreground">{supplier.totalDeliveries} deliveries</div>
                  <div className="text-xs font-medium text-green-600">Value Score: {supplier.valueScore.toFixed(1)}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};