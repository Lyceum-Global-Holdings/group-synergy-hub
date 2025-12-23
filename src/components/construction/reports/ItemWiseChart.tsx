import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ItemSummary } from "@/hooks/construction/useSiteReportAnalytics";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";

interface ItemWiseChartProps {
  data: ItemSummary[];
  isLoading?: boolean;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(142, 76%, 36%)',
  'hsl(47, 100%, 50%)',
  'hsl(280, 65%, 60%)',
  'hsl(200, 80%, 50%)',
  'hsl(340, 75%, 55%)',
  'hsl(160, 60%, 45%)',
];

export function ItemWiseChart({ data, isLoading }: ItemWiseChartProps) {
  const [viewType, setViewType] = useState<'bar' | 'pie'>('bar');

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Item-wise Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Item-wise Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No item data available for selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  // Take top 10 items by net usage
  const topItems = data.slice(0, 10);

  const chartData = topItems.map(item => ({
    name: item.itemCode || item.itemName.substring(0, 10),
    fullName: item.itemName,
    Issued: item.issued,
    Returned: item.returned,
    Net: item.net,
    value: Math.abs(item.net),
  }));

  const pieData = topItems.map((item, index) => ({
    name: item.itemCode || item.itemName.substring(0, 15),
    fullName: item.itemName,
    value: Math.abs(item.net),
    color: COLORS[index % COLORS.length],
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Item-wise Distribution (Top 10)</CardTitle>
        <div className="flex gap-1">
          <Button
            variant={viewType === 'bar' ? 'default' : 'outline'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewType('bar')}
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewType === 'pie' ? 'default' : 'outline'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewType('pie')}
          >
            <PieChartIcon className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {viewType === 'bar' ? (
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-muted-foreground" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  width={55}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload;
                    return item?.fullName || label;
                  }}
                />
                <Legend />
                <Bar dataKey="Issued" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Returned" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    value.toLocaleString() + ' units',
                    props.payload.fullName
                  ]}
                />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
