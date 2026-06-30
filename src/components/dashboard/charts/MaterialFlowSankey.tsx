import { useMemo, useState } from "react";
import type { DashboardAnalytics } from "@/hooks/useDashboardPulse";

interface Props {
  overall?: DashboardAnalytics["sankey"];
  byLocation?: DashboardAnalytics["sankey_by_location"];
  byProduct?: DashboardAnalytics["sankey_by_product"];
}

type Mode = "overall" | "location" | "product";
interface Cat {
  name: string;
  grn: number;
  returns: number;
  issues: number;
}

const COLORS = {
  grn: "hsl(var(--info))",
  returns: "hsl(var(--success))",
  node: "hsl(var(--primary))",
  issues: "hsl(var(--warning))",
};

const MAX_CATS = 10; // safety cap; product is already top-8+Other server-side

export function MaterialFlowSankey({ overall, byLocation, byProduct }: Props) {
  const [mode, setMode] = useState<Mode>("overall");

  const cats: Cat[] = useMemo(() => {
    if (mode === "location") return capCats(byLocation ?? []);
    if (mode === "product") return capCats(byProduct ?? []);
    // overall → single "Inventory" node from the aggregate links
    const links = overall?.links ?? [];
    const v = (s: number, t: number) => Number(links.find((l) => l.source === s && l.target === t)?.value ?? 0);
    return [{ name: "Inventory", grn: v(0, 2), returns: v(1, 2), issues: v(2, 3) }];
  }, [mode, overall, byLocation, byProduct]);

  const totalGrn = cats.reduce((a, c) => a + c.grn, 0);
  const totalReturns = cats.reduce((a, c) => a + c.returns, 0);
  const totalIssues = cats.reduce((a, c) => a + c.issues, 0);
  const hasData = totalGrn + totalReturns + totalIssues > 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-end mb-1">
        <div className="inline-flex rounded-md border border-border p-0.5 text-[11px]">
          {(["overall", "location", "product"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 rounded capitalize transition-colors ${
                mode === m ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p className="text-xs text-muted-foreground p-6 text-center">
          No material movements in the last 30 days{mode !== "overall" ? ` by ${mode}` : ""}.
        </p>
      ) : (
        <SankeySvg cats={cats} totalGrn={totalGrn} totalReturns={totalReturns} totalIssues={totalIssues} />
      )}

      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <Legend color={COLORS.grn} label="GRN (in)" />
        <Legend color={COLORS.returns} label="Returns (in)" />
        <Legend color={COLORS.issues} label="Issues (out)" />
        <span className="text-muted-foreground/70">· last 30d · qty</span>
      </div>
    </div>
  );
}

function capCats(rows: Cat[]): Cat[] {
  const sorted = [...rows].sort((a, b) => b.grn + b.returns + b.issues - (a.grn + a.returns + a.issues));
  if (sorted.length <= MAX_CATS) return sorted;
  const head = sorted.slice(0, MAX_CATS - 1);
  const rest = sorted.slice(MAX_CATS - 1).reduce(
    (acc, c) => ({ name: "Other", grn: acc.grn + c.grn, returns: acc.returns + c.returns, issues: acc.issues + c.issues }),
    { name: "Other", grn: 0, returns: 0, issues: 0 } as Cat,
  );
  return [...head, rest];
}

function SankeySvg({
  cats,
  totalGrn,
  totalReturns,
  totalIssues,
}: {
  cats: Cat[];
  totalGrn: number;
  totalReturns: number;
  totalIssues: number;
}) {
  const n = cats.length;
  const W = 680;
  const H = Math.max(230, 70 + n * 30);
  const nodeW = 14;
  const leftX = 96;
  const midX = W / 2 - nodeW / 2;
  const rightX = W - 110 - nodeW;
  const centerY = H / 2;
  const gap = 12;
  const maxBar = H - 64;
  const minBand = 2;

  // Scale so the tallest of the three columns fits maxBar.
  const sumMidUnits = cats.reduce((a, c) => a + Math.max(c.grn + c.returns, c.issues), 0);
  const sLeft = (maxBar - gap) / Math.max(totalGrn + totalReturns, 1);
  const sMid = (maxBar - gap * Math.max(n - 1, 0)) / Math.max(sumMidUnits, 1);
  const sRight = maxBar / Math.max(totalIssues, 1);
  const scale = Math.min(sLeft, sMid, sRight);
  const px = (v: number) => (v > 0 ? Math.max(v * scale, minBand) : 0);

  const grnH = px(totalGrn);
  const retH = px(totalReturns);
  const issH = px(totalIssues);

  const leftStackH = grnH + (grnH > 0 && retH > 0 ? gap : 0) + retH;
  const grnY = centerY - leftStackH / 2;
  const retY = grnY + grnH + (grnH > 0 && retH > 0 ? gap : 0);
  const issuesY = centerY - issH / 2;

  const catH = cats.map((c) => Math.max(px(c.grn) + px(c.returns), px(c.issues), minBand));
  const midStackH = catH.reduce((a, h) => a + h, 0) + gap * Math.max(n - 1, 0);
  let catY = centerY - midStackH / 2;
  const catTops = catH.map((h) => {
    const y = catY;
    catY += h + gap;
    return y;
  });

  let grnCursor = grnY;
  let retCursor = retY;
  let issCursor = issuesY;

  const ribbons: JSX.Element[] = [];
  cats.forEach((c, k) => {
    const cy = catTops[k];
    const gW = px(c.grn);
    const rW = px(c.returns);
    const iW = px(c.issues);
    if (gW > 0) {
      ribbons.push(<path key={`g${k}`} d={band(leftX + nodeW, grnCursor, midX, cy, gW)} fill={COLORS.grn} opacity={0.3} />);
      grnCursor += gW;
    }
    if (rW > 0) {
      ribbons.push(<path key={`r${k}`} d={band(leftX + nodeW, retCursor, midX, cy + gW, rW)} fill={COLORS.returns} opacity={0.3} />);
      retCursor += rW;
    }
    if (iW > 0) {
      ribbons.push(<path key={`i${k}`} d={band(midX + nodeW, cy, rightX, issCursor, iW)} fill={COLORS.issues} opacity={0.3} />);
      issCursor += iW;
    }
  });

  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: v % 1 === 0 ? 0 : 2 });
  const single = cats.length === 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Material flow Sankey">
      {ribbons}

      {/* source nodes */}
      {grnH > 0 && <rect x={leftX} y={grnY} width={nodeW} height={grnH} rx={3} fill={COLORS.grn} />}
      {retH > 0 && <rect x={leftX} y={retY} width={nodeW} height={retH} rx={3} fill={COLORS.returns} />}
      <NodeLabel x={leftX - 8} y={grnY + grnH / 2} anchor="end" name="GRN" value={fmt(totalGrn)} dim={grnH === 0} />
      <NodeLabel x={leftX - 8} y={retY + retH / 2} anchor="end" name="Returns" value={fmt(totalReturns)} dim={retH === 0} />

      {/* middle category nodes */}
      {cats.map((c, k) => (
        <g key={`node${k}`}>
          <rect x={midX} y={catTops[k]} width={nodeW} height={catH[k]} rx={3} fill={COLORS.node} />
          {single ? (
            <text x={midX + nodeW / 2} y={catTops[k] - 8} textAnchor="middle" className="fill-foreground" fontSize={12} fontWeight={700}>
              {c.name}
            </text>
          ) : (
            <text
              x={midX + nodeW + 6}
              y={catTops[k] + catH[k] / 2 + 3}
              textAnchor="start"
              className="fill-foreground"
              fontSize={10}
              fontWeight={600}
            >
              {truncate(c.name, 18)}
            </text>
          )}
        </g>
      ))}

      {/* issues sink */}
      {issH > 0 && <rect x={rightX} y={issuesY} width={nodeW} height={issH} rx={3} fill={COLORS.issues} />}
      <NodeLabel x={rightX + nodeW + 8} y={issuesY + issH / 2} anchor="start" name="Issues" value={fmt(totalIssues)} dim={issH === 0} />
    </svg>
  );
}

function band(x0: number, y0: number, x1: number, y1: number, thick: number) {
  if (thick <= 0) return "";
  const cx = (x0 + x1) / 2;
  return `M ${x0} ${y0} C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1} L ${x1} ${y1 + thick} C ${cx} ${y1 + thick}, ${cx} ${y0 + thick}, ${x0} ${y0 + thick} Z`;
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function NodeLabel({
  x,
  y,
  anchor,
  name,
  value,
  dim,
}: {
  x: number;
  y: number;
  anchor: "start" | "end";
  name: string;
  value: string;
  dim?: boolean;
}) {
  return (
    <g opacity={dim ? 0.5 : 1}>
      <text x={x} y={y - 2} textAnchor={anchor} className="fill-foreground" fontSize={12} fontWeight={700}>
        {name}
      </text>
      <text x={x} y={y + 12} textAnchor={anchor} className="fill-muted-foreground" fontSize={11} style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </text>
    </g>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
