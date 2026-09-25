import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

interface SparklineProps {
  data: Array<{ d: string; v: number }> | undefined;
  color?: string;
  height?: number;
  /** Scale the y-axis to the data range instead of starting at zero (e.g. prices). */
  fitToData?: boolean;
}

export function Sparkline({ data, color = "hsl(var(--primary))", height = 48, fitToData }: SparklineProps) {
  // One gradient per instance: ids built from the colour string were invalid
  // (spaces, parens) and collided when two cards shared a colour.
  const gradientId = `spark-${useId().replace(/:/g, "")}`;
  if (!data || data.length === 0) {
    return <div className="rounded-xl bg-muted/40" style={{ height }} />;
  }
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {fitToData && <YAxis hide domain={["dataMin", "dataMax"]} />}
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
