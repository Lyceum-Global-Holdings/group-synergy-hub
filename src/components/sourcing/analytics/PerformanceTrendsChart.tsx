import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { PerformanceTrend } from "@/lib/supplierAnalytics";

interface PerformanceTrendsChartProps {
  trends: PerformanceTrend[];
  supplierName?: string;
}

export const PerformanceTrendsChart = ({ trends, supplierName }: PerformanceTrendsChartProps) => {
  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const chartData = trends.map(trend => ({
    month: formatMonth(trend.month),
    performance: trend.performance,
    quality: trend.quality,
    punctuality: trend.punctuality,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {supplierName ? `${supplierName} - Performance Trends` : 'Performance Trends'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                domain={[0, 100]}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
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
                name="Overall Performance"
              />
              <Line 
                type="monotone" 
                dataKey="quality" 
                stroke="hsl(142, 76%, 36%)" 
                strokeWidth={2}
                name="Quality Score"
              />
              <Line 
                type="monotone" 
                dataKey="punctuality" 
                stroke="hsl(221, 83%, 53%)" 
                strokeWidth={2}
                name="Punctuality Score"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No trend data available
          </div>
        )}
      </CardContent>
    </Card>
  );
};