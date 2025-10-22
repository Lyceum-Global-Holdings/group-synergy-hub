import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface GaugeWidgetProps {
  title: string;
  value: number;
  maxValue: number;
  unit?: string;
  thresholds?: {
    warning?: number;
    danger?: number;
  };
}

export function GaugeWidget({ title, value, maxValue, unit, thresholds }: GaugeWidgetProps) {
  const percentage = (value / maxValue) * 100;
  
  const getColor = () => {
    if (thresholds?.danger && percentage >= thresholds.danger) {
      return "hsl(var(--destructive))";
    }
    if (thresholds?.warning && percentage >= thresholds.warning) {
      return "hsl(var(--warning))";
    }
    return "hsl(var(--success))";
  };

  const data = [
    { name: "Value", value: value },
    { name: "Remaining", value: Math.max(0, maxValue - value) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                startAngle={180}
                endAngle={0}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={0}
                dataKey="value"
              >
                <Cell fill={getColor()} />
                <Cell fill="hsl(var(--muted))" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold">{percentage.toFixed(0)}%</div>
            <div className="text-sm text-muted-foreground">
              {value.toLocaleString()} / {maxValue.toLocaleString()} {unit}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
