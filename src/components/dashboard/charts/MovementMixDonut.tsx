import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  data: Array<{ type: string; count: number }>;
}

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--info))",
  "hsl(var(--muted-foreground))",
];

const LABEL: Record<string, string> = {
  receipt: "Receipt",
  issue: "Issue",
  return: "Return",
  transfer: "Transfer",
  adjustment: "Adjustment",
  reservation: "Reservation",
};

export function MovementMixDonut({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-xs text-muted-foreground p-6 text-center">No movements in the last 7 days.</p>;
  }
  const total = data.reduce((s, r) => s + Number(r.count || 0), 0);
  const chartData = data.map((r) => ({ name: LABEL[r.type] || r.type, value: Number(r.count) }));

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-[140px] h-[140px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={65}
              paddingAngle={2}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="font-mono text-xl font-bold tabular-nums text-foreground">{total}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">moves</div>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {chartData.map((row, i) => (
          <div key={row.name} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="truncate text-muted-foreground">{row.name}</span>
            </div>
            <span className="font-mono tabular-nums text-foreground shrink-0">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
