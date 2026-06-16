import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: Array<{ d: string; inbound: number; outbound: number }>;
}

export function InboundOutboundChart({ data }: Props) {
  const formatted = data.map((r) => ({
    ...r,
    label: new Date(r.d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="inbound" stackId="a" fill="hsl(var(--success))" radius={[0, 0, 0, 0]} />
        <Bar dataKey="outbound" stackId="a" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
