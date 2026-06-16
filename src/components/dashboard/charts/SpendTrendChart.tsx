import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: Array<{ w: string; amount: number }>;
}

const formatCurrency = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
};

export function SpendTrendChart({ data }: Props) {
  const formatted = data.map((r) => ({
    ...r,
    label: new Date(r.w).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => formatCurrency(Number(v))}
        />
        <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#gSpend)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
