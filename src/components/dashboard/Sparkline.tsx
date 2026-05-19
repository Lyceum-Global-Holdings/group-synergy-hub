import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: Array<{ d: string; v: number }> | undefined;
  color?: string;
  height?: number;
}

export function Sparkline({ data, color = "hsl(var(--primary))", height = 48 }: SparklineProps) {
  if (!data || data.length === 0) {
    return <div className="h-12 rounded bg-muted/30" />;
  }
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#spark-${color})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
