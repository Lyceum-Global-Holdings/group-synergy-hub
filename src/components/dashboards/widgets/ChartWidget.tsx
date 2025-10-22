import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { WidgetType } from "@/types/dashboard";

interface ChartWidgetProps {
  title: string;
  chartType: WidgetType;
  data: any[];
  config?: {
    colors?: string[];
    showLegend?: boolean;
    showGrid?: boolean;
  };
}

const DEFAULT_COLORS = [
  "hsl(var(--chart-1))", 
  "hsl(var(--chart-2))", 
  "hsl(var(--chart-3))", 
  "hsl(var(--chart-4))", 
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))"
];

export function ChartWidget({ title, chartType, data, config = {} }: ChartWidgetProps) {
  const { colors = DEFAULT_COLORS, showLegend = true, showGrid = true } = config;

  const renderChart = () => {
    if (!data || data.length === 0) {
      return <div className="flex items-center justify-center h-48 text-muted-foreground">No data available</div>;
    }

    const commonProps = {
      data,
      margin: { top: 5, right: 20, left: 0, bottom: 5 },
    };

    switch (chartType) {
      case "line_chart":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart {...commonProps}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
              {showLegend && <Legend />}
              <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case "bar_chart":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart {...commonProps}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
              {showLegend && <Legend />}
              <Bar dataKey="value">
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "area_chart":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart {...commonProps}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
              {showLegend && <Legend />}
              <Area type="monotone" dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "pie_chart":
        const totalValue = data.reduce((sum, entry) => sum + entry.value, 0);
        return (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={(entry) => `${entry.name} (${((entry.value / totalValue) * 100).toFixed(1)}%)`}
                outerRadius={80}
                fill={colors[0]}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                formatter={(value: number) => [
                  `${value.toLocaleString()} (${((value / totalValue) * 100).toFixed(1)}%)`,
                  "Value"
                ]}
              />
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <div className="text-muted-foreground">Unsupported chart type</div>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
}
