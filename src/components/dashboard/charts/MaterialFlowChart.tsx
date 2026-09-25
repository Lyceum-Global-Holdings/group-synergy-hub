import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartTooltipStyle } from "../DashCard";

interface Props {
  data: Array<{ d: string; issued: number; returned: number }>;
}

export const FLOW_COLORS = { issued: "hsl(var(--primary))", returned: "hsl(199 89% 55%)" };

const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k` : String(v));

export function MaterialFlowChart({ data }: Props) {
  const formatted = data.map((r) => ({
    ...r,
    label: new Date(r.d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={formatted} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="gIssued" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={FLOW_COLORS.issued} stopOpacity={0.3} />
            <stop offset="100%" stopColor={FLOW_COLORS.issued} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gReturned" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={FLOW_COLORS.returned} stopOpacity={0.22} />
            <stop offset="100%" stopColor={FLOW_COLORS.returned} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.7} vertical={false} />
        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={6} minTickGap={16} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compact} />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.25, strokeWidth: 24 }} />
        <Area type="monotone" dataKey="issued" name="Issued" stroke={FLOW_COLORS.issued} fill="url(#gIssued)" strokeWidth={2.5} activeDot={{ r: 5, strokeWidth: 0 }} />
        <Area type="monotone" dataKey="returned" name="Returned" stroke={FLOW_COLORS.returned} fill="url(#gReturned)" strokeWidth={2} strokeDasharray="5 4" activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
