import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartTooltipStyle } from "../DashCard";

interface Props {
  data: Array<{ d: string; inbound: number; outbound: number }>;
}

export const IO_COLORS = { inbound: "hsl(var(--primary))", outbound: "hsl(199 89% 60%)" };

const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k` : String(v));

export function InboundOutboundChart({ data }: Props) {
  const formatted = data.map((r) => ({
    ...r,
    label: new Date(r.d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={formatted} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.7} vertical={false} />
        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={6} minTickGap={16} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compact} />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "hsl(var(--muted))", radius: 8 } as never} />
        <Bar dataKey="inbound" name="Inbound (GRN)" stackId="a" fill={IO_COLORS.inbound} maxBarSize={22} />
        <Bar dataKey="outbound" name="Outbound (issues)" stackId="a" fill={IO_COLORS.outbound} radius={[6, 6, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
