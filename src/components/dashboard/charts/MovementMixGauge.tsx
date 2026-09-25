import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { chartTooltipStyle, HATCH } from "../DashCard";

interface Props {
  data: Array<{ type: string; count: number }>;
}

// Blue family first, amber last for the rarer adjustment-type moves.
const PALETTE = [
  "hsl(var(--primary))",
  "hsl(224 76% 28%)",
  "hsl(199 89% 58%)",
  "hsl(239 70% 62%)",
  "hsl(186 70% 42%)",
  "hsl(36 95% 50%)",
];

const LABEL: Record<string, string> = {
  material_issue: "Issues",
  material_return: "Returns",
  goods_receipt: "Goods receipts",
  transfer_out: "Transfers out",
  transfer_in: "Transfers in",
  receipt: "Receipts",
  issue: "Issues",
  return: "Returns",
  transfer: "Transfers",
  adjustment: "Adjustments",
  reservation: "Reservations",
};

const humanize = (t: string) =>
  LABEL[t] ?? t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function MovementMixGauge({ data }: Props) {
  const rows = (data ?? [])
    .map((r) => ({ name: humanize(r.type), value: Number(r.count) || 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative mx-auto aspect-[2/1] w-full max-w-[300px]">
        {total === 0 ? (
          // Empty track so the card keeps its shape.
          <div
            className="absolute inset-0 rounded-t-full"
            style={{ background: HATCH, WebkitMask: "radial-gradient(circle at 50% 100%, transparent 43%, #000 43.5%)", mask: "radial-gradient(circle at 50% 100%, transparent 43%, #000 43.5%)" }}
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius="122%"
                outerRadius="196%"
                paddingAngle={1.5}
                cornerRadius={6}
                minAngle={3}
                stroke="none"
                isAnimationActive={false}
              >
                {rows.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
          <div className="text-4xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {total.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">moves · 7 days</div>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="truncate text-muted-foreground">{r.name}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums text-foreground">{r.value.toLocaleString()}</span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="col-span-2 text-center text-xs text-muted-foreground">No movements in the last 7 days.</li>
        )}
      </ul>
    </div>
  );
}
