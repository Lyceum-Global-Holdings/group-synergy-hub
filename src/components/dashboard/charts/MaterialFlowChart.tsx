import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: Array<{ d: string; issued: number; returned: number }>;
}

export function MaterialFlowChart({ data }: Props) {
  const formatted = data.map((r) => ({
    ...r,
    label: new Date(r.d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gIssued" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gReturned" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Area type="monotone" dataKey="issued" stroke="hsl(var(--primary))" fill="url(#gIssued)" strokeWidth={2} />
        <Area type="monotone" dataKey="returned" stroke="hsl(var(--warning))" fill="url(#gReturned)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
