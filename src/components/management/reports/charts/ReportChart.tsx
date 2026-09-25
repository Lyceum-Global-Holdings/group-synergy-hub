import type { ChartData, ChartSpec } from "@/lib/reports/visuals";
import { formatCompact, formatFull } from "@/lib/reports/visuals";

// Concrete colours/fonts (no CSS variables) so the same SVG renders
// identically on screen and when rasterised for PDF / Excel exports.
export const CHART_PALETTE = ["#0b63ce", "#38bdf8", "#6366f1", "#14b8a6", "#1e3a8a", "#f59e0b", "#94a3b8"];
const INK = "#0f172a";
const MUTED = "#64748b";
const GRID = "#e2e8f0";
const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
export const CHART_WIDTH = 640;

interface ChartProps {
  spec: ChartSpec;
  data: ChartData;
  currency: string;
  /** Emit explicit pixel width/height (for rasterising); otherwise scales to its container. */
  fixedSize?: boolean;
}

export function chartHeight(spec: ChartSpec, data: ChartData): number {
  if (spec.kind === "hbar") return 28 + data.categories.length * 30;
  if (spec.kind === "donut") return 250;
  return 300;
}

/** Round a range to 1/2/5×10ⁿ steps so axis ticks read cleanly. */
function niceScale(rawMin: number, rawMax: number, ticks = 5) {
  let min = Math.min(0, rawMin);
  let max = Math.max(0, rawMax);
  if (min === max) max = min + 1;
  const nice = (x: number, round: boolean) => {
    const exp = Math.floor(Math.log10(x));
    const f = x / 10 ** exp;
    const nf = round ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) : f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nf * 10 ** exp;
  };
  const step = nice(nice(max - min, false) / (ticks - 1), true);
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) out.push(Number(v.toPrecision(12)));
  return { min, max, ticks: out };
}

const text = (extra: Record<string, unknown> = {}) => ({ fontFamily: FONT, fontSize: 11, fill: MUTED, ...extra });

function Frame({ w, h, fixedSize, label, children }: { w: number; h: number; fixedSize?: boolean; label: string; children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      width={fixedSize ? w : "100%"}
      height={fixedSize ? h : undefined}
      role="img"
      aria-label={label}
      style={fixedSize ? undefined : { display: "block", height: "auto" }}
    >
      <rect width={w} height={h} fill="#ffffff" />
      {children}
    </svg>
  );
}

const legendLabel = (n: string) => (n.length > 22 ? `${n.slice(0, 21)}…` : n);

/** Lay legend entries out left-to-right, wrapping onto new rows before `maxX`. */
function legendLayout(names: string[], x: number, maxX: number) {
  const items: { name: string; label: string; x: number; row: number }[] = [];
  let cursor = x;
  let row = 0;
  for (const n of names) {
    const label = legendLabel(n);
    const width = 26 + label.length * 6.2;
    if (cursor + width > maxX && cursor > x) {
      row += 1;
      cursor = x;
    }
    items.push({ name: n, label, x: cursor, row });
    cursor += width;
  }
  return { items, rows: row + 1 };
}

function Legend({ layout, y }: { layout: ReturnType<typeof legendLayout>; y: number }) {
  return (
    <g>
      {layout.items.map((it, i) => (
        <g key={it.name} transform={`translate(${it.x},${y + it.row * 18})`}>
          <rect width={10} height={10} rx={3} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          <text x={14} y={9} {...text({ fill: INK })}>{it.label}</text>
        </g>
      ))}
    </g>
  );
}

function HBar({ spec, data, currency, fixedSize }: ChartProps) {
  const w = CHART_WIDTH;
  const h = chartHeight(spec, data);
  const values = data.series[0]?.values ?? [];
  const left = 170;
  const right = 86;
  const { min, max } = niceScale(Math.min(...values), Math.max(...values));
  const sx = (v: number) => left + ((v - min) / (max - min)) * (w - left - right);
  const zero = sx(0);
  return (
    <Frame w={w} h={h} fixedSize={fixedSize} label={spec.title}>
      <line x1={zero} x2={zero} y1={14} y2={h - 10} stroke={GRID} />
      {data.categories.map((c, i) => {
        const v = values[i] ?? 0;
        const y = 18 + i * 30;
        const x0 = Math.min(zero, sx(v));
        const bw = Math.max(Math.abs(sx(v) - zero), v === 0 ? 0 : 2);
        // Value label beside the bar; if that would run into the category
        // labels (long negative bars) put it inside the bar, or past the zero line.
        const label = formatCompact(v, data.format, currency);
        const lw = label.length * 6.6 + 4;
        let lx = v < 0 ? x0 - 6 : x0 + bw + 6;
        let anchor: "start" | "end" = v < 0 ? "end" : "start";
        let lfill = INK;
        if (v < 0 && lx - lw < left) {
          if (bw > lw + 12) {
            lx = x0 + 6;
            anchor = "start";
            lfill = "#ffffff";
          } else {
            lx = zero + 6;
            anchor = "start";
          }
        }
        return (
          <g key={`${c}-${i}`}>
            <title>{`${data.fullCategories[i]}: ${formatFull(v, data.format, currency)}`}</title>
            <text x={left - 10} y={y + 14} textAnchor="end" {...text({ fill: INK })}>
              {c.length > 26 ? `${c.slice(0, 25)}…` : c}
            </text>
            <rect x={x0} y={y + 3} width={bw} height={18} rx={5} fill={v < 0 ? "#f97316" : CHART_PALETTE[0]} opacity={i === 0 ? 1 : 0.55 + 0.45 * (1 - i / Math.max(values.length, 1))} />
            <text x={lx} y={y + 16} textAnchor={anchor} {...text({ fill: lfill, fontWeight: 600 })}>
              {label}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

function Columns({ spec, data, currency, fixedSize }: ChartProps) {
  const w = CHART_WIDTH;
  const h = 300;
  const stacked = spec.kind === "stacked";
  const multi = data.series.length > 1;
  const left = 64;
  const right = 12;
  const legend = legendLayout(data.series.map((s) => s.name), left, w - right);
  const top = multi ? 16 + legend.rows * 18 : 14;
  const n = data.categories.length;
  const rotate = n > 8 || data.categories.some((c) => c.length > 10);
  const bottom = rotate ? 66 : 32;
  const plotH = h - top - bottom;
  const plotW = w - left - right;

  const totals = data.categories.map((_, i) => {
    let pos = 0;
    let neg = 0;
    data.series.forEach((s) => (s.values[i] >= 0 ? (pos += s.values[i]) : (neg += s.values[i])));
    return { pos, neg };
  });
  const all = stacked ? totals.flatMap((t) => [t.pos, t.neg]) : data.series.flatMap((s) => s.values);
  const { min, max, ticks } = niceScale(Math.min(...all), Math.max(...all));
  const sy = (v: number) => top + plotH - ((v - min) / (max - min)) * plotH;
  const band = plotW / Math.max(n, 1);
  const groupW = band * 0.7;
  const barW = stacked || !multi ? groupW : groupW / data.series.length;

  return (
    <Frame w={w} h={h} fixedSize={fixedSize} label={spec.title}>
      {multi && <Legend layout={legend} y={8} />}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={w - right} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? "#cbd5e1" : GRID} />
          <text x={left - 8} y={sy(t) + 4} textAnchor="end" {...text()}>
            {formatCompact(t, data.format, undefined)}
          </text>
        </g>
      ))}
      {data.categories.map((c, i) => {
        const gx = left + i * band + (band - groupW) / 2;
        let pos = 0;
        let neg = 0;
        return (
          <g key={`${c}-${i}`}>
            {data.series.map((s, si) => {
              const v = s.values[i] ?? 0;
              let y0: number;
              let y1: number;
              let x = gx + (stacked || !multi ? 0 : si * barW);
              if (stacked) {
                if (v >= 0) {
                  y0 = sy(pos);
                  pos += v;
                  y1 = sy(pos);
                } else {
                  y0 = sy(neg);
                  neg += v;
                  y1 = sy(neg);
                }
              } else {
                y0 = sy(0);
                y1 = sy(v);
              }
              x = Math.round(x * 10) / 10;
              return (
                <rect
                  key={s.name}
                  x={x}
                  y={Math.min(y0, y1)}
                  width={Math.max(barW - (stacked || !multi ? 0 : 2), 1)}
                  height={Math.max(Math.abs(y1 - y0), v === 0 ? 0 : 1)}
                  rx={stacked ? 0 : 4}
                  fill={CHART_PALETTE[si % CHART_PALETTE.length]}
                >
                  <title>{`${data.fullCategories[i]} · ${s.name}: ${formatFull(v, data.format, currency)}`}</title>
                </rect>
              );
            })}
            <text
              {...text()}
              x={left + i * band + band / 2}
              y={h - bottom + 16}
              textAnchor={rotate ? "end" : "middle"}
              transform={rotate ? `rotate(-40 ${left + i * band + band / 2} ${h - bottom + 16})` : undefined}
            >
              {c.length > 16 ? `${c.slice(0, 15)}…` : c}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

function Line({ spec, data, currency, fixedSize }: ChartProps) {
  const w = CHART_WIDTH;
  const h = 300;
  const multi = data.series.length > 1;
  const left = 64;
  const right = 16;
  const bottom = 32;
  const legend = legendLayout(data.series.map((s) => s.name), left, w - right);
  const top = multi ? 16 + legend.rows * 18 : 14;
  const plotH = h - top - bottom;
  const plotW = w - left - right;
  const n = data.categories.length;
  const all = data.series.flatMap((s) => s.values);
  const { min, max, ticks } = niceScale(Math.min(...all), Math.max(...all));
  const sy = (v: number) => top + plotH - ((v - min) / (max - min)) * plotH;
  const sx = (i: number) => left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  return (
    <Frame w={w} h={h} fixedSize={fixedSize} label={spec.title}>
      {multi && <Legend layout={legend} y={8} />}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={w - right} y1={sy(t)} y2={sy(t)} stroke={GRID} />
          <text x={left - 8} y={sy(t) + 4} textAnchor="end" {...text()}>
            {formatCompact(t, data.format, undefined)}
          </text>
        </g>
      ))}
      {data.series.map((s, si) => {
        const color = CHART_PALETTE[si % CHART_PALETTE.length];
        const pts = s.values.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`);
        return (
          <g key={s.name}>
            {!multi && (
              <path d={`M${sx(0)},${sy(0)} L${pts.join(" L")} L${sx(n - 1)},${sy(0)} Z`} fill={color} opacity={0.1} />
            )}
            <path d={`M${pts.join(" L")}`} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {n <= 40 &&
              s.values.map((v, i) => (
                <circle key={i} cx={sx(i)} cy={sy(v)} r={3} fill="#ffffff" stroke={color} strokeWidth={2}>
                  <title>{`${data.fullCategories[i]} · ${s.name}: ${formatFull(v, data.format, currency)}`}</title>
                </circle>
              ))}
          </g>
        );
      })}
      {data.categories.map((c, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text key={i} x={sx(i)} y={h - bottom + 18} textAnchor="middle" {...text()}>
            {c}
          </text>
        ) : null,
      )}
    </Frame>
  );
}

function Donut({ spec, data, currency, fixedSize }: ChartProps) {
  const w = CHART_WIDTH;
  const h = chartHeight(spec, data);
  const values = (data.series[0]?.values ?? []).map((v) => Math.max(v, 0));
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const cx = 130;
  const cy = h / 2;
  const r = 100;
  const inner = 62;
  let angle = -Math.PI / 2;

  const arc = (a0: number, a1: number) => {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
    return `M${p(r, a0)} A${r},${r} 0 ${large} 1 ${p(r, a1)} L${p(inner, a1)} A${inner},${inner} 0 ${large} 0 ${p(inner, a0)} Z`;
  };

  return (
    <Frame w={w} h={h} fixedSize={fixedSize} label={spec.title}>
      {values.map((v, i) => {
        const share = v / total;
        // An SVG arc can't start and end at the same point, so a 100% slice
        // stops a hair short of the full circle.
        const a0 = angle;
        const a1 = angle + share * Math.PI * 2 - (share >= 0.999 ? 0.0001 : 0);
        angle += share * Math.PI * 2;
        if (v <= 0) return null;
        return (
          <path key={i} d={arc(a0, a1)} fill={CHART_PALETTE[i % CHART_PALETTE.length]} stroke="#ffffff" strokeWidth={2}>
            <title>{`${data.fullCategories[i]}: ${formatFull(v, data.format, currency)} (${((v / total) * 100).toFixed(1)}%)`}</title>
          </path>
        );
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" {...text({ fill: INK, fontSize: 15, fontWeight: 700 })}>
        {formatCompact(total, data.format, undefined)}
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" {...text({ fontSize: 10 })}>
        total
      </text>
      {data.categories.map((c, i) => {
        const y = cy - (data.categories.length * 26) / 2 + i * 26 + 8;
        return (
          <g key={`${c}-${i}`}>
            <rect x={270} y={y - 9} width={11} height={11} rx={3} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
            <text x={289} y={y} {...text({ fill: INK })}>
              {c.length > 30 ? `${c.slice(0, 29)}…` : c}
            </text>
            <text x={w - 70} y={y} textAnchor="end" {...text({ fill: INK, fontWeight: 600 })}>
              {formatCompact(values[i], data.format, currency)}
            </text>
            <text x={w - 16} y={y} textAnchor="end" {...text()}>
              {`${((values[i] / total) * 100).toFixed(1)}%`}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

/** Renders one report chart as self-contained SVG. */
export function ReportChart(props: ChartProps) {
  if (!props.data.categories.length) return null;
  switch (props.spec.kind) {
    case "hbar":
      return <HBar {...props} />;
    case "donut":
      return <Donut {...props} />;
    case "line":
      return <Line {...props} />;
    default:
      return <Columns {...props} />;
  }
}
