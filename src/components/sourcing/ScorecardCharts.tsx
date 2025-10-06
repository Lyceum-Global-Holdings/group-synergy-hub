import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierEvaluation } from "@/types/supplierEvaluation";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ScorecardChartsProps {
  evaluations: SupplierEvaluation[];
}

export const ScorecardCharts = ({ evaluations }: ScorecardChartsProps) => {
  // Performance trends by month
  const monthlyPerformance = evaluations.reduce((acc, evaluation) => {
    const date = new Date(evaluation.evaluation_period_start);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = { count: 0, totalPerformance: 0 };
    }
    acc[monthKey].count++;
    acc[monthKey].totalPerformance += evaluation.performance_rate;
    return acc;
  }, {} as Record<string, { count: number; totalPerformance: number }>);

  const trendData = Object.entries(monthlyPerformance)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      performance: Number((data.totalPerformance / data.count).toFixed(1)),
      evaluations: data.count,
    }));

  // Top suppliers by performance
  const supplierPerformance = evaluations.reduce((acc, evaluation) => {
    const supplierName = evaluation.supplier?.name || 'Unknown';
    if (!acc[supplierName]) {
      acc[supplierName] = { count: 0, totalPerformance: 0 };
    }
    acc[supplierName].count++;
    acc[supplierName].totalPerformance += evaluation.performance_rate;
    return acc;
  }, {} as Record<string, { count: number; totalPerformance: number }>);

  const topSuppliers = Object.entries(supplierPerformance)
    .map(([name, data]) => ({
      name,
      avgPerformance: Number((data.totalPerformance / data.count).toFixed(1)),
      evaluations: data.count,
    }))
    .sort((a, b) => b.avgPerformance - a.avgPerformance)
    .slice(0, 10);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Performance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  className="text-xs"
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  className="text-xs"
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="performance" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Avg Performance %"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No trend data available
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 Suppliers</CardTitle>
        </CardHeader>
        <CardContent>
          {topSuppliers.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topSuppliers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  className="text-xs"
                />
                <YAxis 
                  type="category"
                  dataKey="name" 
                  width={120}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  className="text-xs"
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Bar 
                  dataKey="avgPerformance" 
                  fill="hsl(var(--primary))"
                  name="Avg Performance %"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No supplier data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};