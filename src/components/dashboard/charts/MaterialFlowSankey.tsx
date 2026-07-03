import { useMemo } from "react";
import type { SankeyFlow } from "@/hooks/useDashboardPulse";

interface Props {
  data?: SankeyFlow;
}

const COL = {
  grn: "hsl(var(--info))",
  returns: "hsl(var(--success))",
  node: "hsl(var(--primary))",
  issues: "hsl(var(--warning))",
};

interface RNode {
  name: string;
  h: number;
  x: number;
  y: number;
  inCur: number;
  outCur: number;
}
interface RLink {
  s: RNode;
  t: RNode;
  v: number;
  color: string;
  path?: string;
}

/**
 * Compact multi-stage material-flow Sankey:
 *   GRN + Returns ─► Location ─► Product ─► Issues   (30d qty)
 * Custom SVG, fixed ~230px height, top locations/products from the server.
 */
export function MaterialFlowSankey({ data }: Props) {
  const model = useMemo(() => buildModel(data), [data]);

  if (!model) {
    return <p className="text-xs text-muted-foreground p-6 text-center">No material movements in the last 30 days.</p>;
  }

  const { W, H, nodeW, links, cols, labels } = model;
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: v % 1 === 0 ? 0 : 2 });

  return (
    <div className="w-full">
      {/* column captions */}
      <div className="flex justify-between px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Source</span>
        <span>Location</span>
        <span>Product</span>
        <span>Issues</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 200, display: "block" }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Material flow Sankey"
      >
        {links.map((lk, i) => (
          <path key={i} d={lk.path} fill={lk.color} opacity={0.28} />
        ))}
        {cols.flat().map((n, i) => (
          <rect key={i} x={n.x} y={n.y} width={nodeW} height={Math.max(n.h, 2)} rx={2.5} fill={n.color}>
            <title>{`${n.name}`}</title>
          </rect>
        ))}
        {labels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={l.y}
            textAnchor={l.anchor}
            className={l.muted ? "fill-muted-foreground" : "fill-foreground"}
            fontSize={l.size}
            fontWeight={l.weight}
            style={l.tabular ? { fontVariantNumeric: "tabular-nums" } : undefined}
          >
            {l.text}
          </text>
        ))}
      </svg>
      <div className="mt-1.5 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <Legend color={COL.grn} label="GRN (in)" />
        <Legend color={COL.returns} label="Returns (in)" />
        <Legend color={COL.issues} label="Issues (out)" />
        <span className="text-muted-foreground/70">· last 30d · qty · <span className="italic">{fmt(model.totalIssues)} issued</span></span>
      </div>
    </div>
  );
}

type NodeColor = RNode & { color: string; name: string };

function buildModel(data?: SankeyFlow) {
  const locations = data?.locations ?? [];
  const products = data?.products ?? [];
  const rawLinks = data?.links ?? [];
  const totalGrn = locations.reduce((a, l) => a + Number(l.grn || 0), 0);
  const totalReturns = locations.reduce((a, l) => a + Number(l.returns || 0), 0);
  const totalIssues = products.reduce((a, p) => a + Number(p.issues || 0), 0);
  if (totalGrn + totalReturns + totalIssues === 0) return null;

  const W = 1100;
  const nodeW = 12;
  const gap = 8;
  const xs = [150, 450, 750, 980]; // source, location, product, issues
  const H = 200;
  const centerY = H / 2;
  const maxBar = 134;

  // Per-node "unit" heights: source col by grn/returns, loc by inbound, prod by max(inbound,issues), issues by total.
  const locInbound = locations.map((l) => Number(l.grn || 0) + Number(l.returns || 0));
  const prodInbound = products.map((p) => rawLinks.filter((k) => k.p === p.key).reduce((a, k) => a + Number(k.v || 0), 0));
  const prodUnit = products.map((p, i) => Math.max(prodInbound[i], Number(p.issues || 0)));

  const colSum = [
    totalGrn + totalReturns,
    locInbound.reduce((a, b) => a + b, 0),
    prodUnit.reduce((a, b) => a + b, 0),
    totalIssues,
  ];
  const gaps = [1, Math.max(locations.length - 1, 0), Math.max(products.length - 1, 0), 0];
  const scale = Math.min(...colSum.map((s, i) => (maxBar - gap * gaps[i]) / Math.max(s, 1)));
  const px = (v: number) => (v > 0 ? Math.max(v * scale, 2) : 0);

  const stack = (heights: number[], x: number): RNode[] => {
    const total = heights.reduce((a, b) => a + b, 0) + gap * Math.max(heights.length - 1, 0);
    let y = centerY - total / 2;
    return heights.map((h) => {
      const n: RNode = { name: "", h, x, y, inCur: y, outCur: y };
      y += h + gap;
      return n;
    });
  };

  // Column 0: sources
  const srcHeights = [px(totalGrn), px(totalReturns)];
  const src = stack(srcHeights, xs[0]) as NodeColor[];
  src[0].name = "GRN"; (src[0] as NodeColor).color = COL.grn;
  src[1].name = "Returns"; (src[1] as NodeColor).color = COL.returns;

  // Column 1: locations
  const loc = stack(locInbound.map(px), xs[1]) as NodeColor[];
  loc.forEach((n, i) => { n.name = locations[i].name; n.color = COL.node; });

  // Column 2: products
  const prod = stack(prodUnit.map(px), xs[2]) as NodeColor[];
  prod.forEach((n, i) => { n.name = products[i].name; n.color = COL.node; });

  // Column 3: issues
  const iss = stack([px(totalIssues)], xs[3]) as NodeColor[];
  iss[0].name = "Issues"; iss[0].color = COL.issues;

  const locByKey = new Map(locations.map((l, i) => [l.key, loc[i]]));
  const prodByKey = new Map(products.map((p, i) => [p.key, prod[i]]));

  const links: RLink[] = [];
  const addLink = (s: RNode, t: RNode, v: number, color: string) => {
    const th = px(v);
    if (th <= 0) return;
    links.push({ s, t, v: th, color });
  };

  // sources -> locations (grn + returns per location)
  locations.forEach((l, i) => {
    addLink(src[0], loc[i], Number(l.grn || 0), COL.grn);
    addLink(src[1], loc[i], Number(l.returns || 0), COL.returns);
  });
  // locations -> products (inbound cross-tab), sorted for tidy routing
  [...rawLinks]
    .sort((a, b) => {
      const la = locations.findIndex((x) => x.key === a.l), lb = locations.findIndex((x) => x.key === b.l);
      if (la !== lb) return la - lb;
      return products.findIndex((x) => x.key === a.p) - products.findIndex((x) => x.key === b.p);
    })
    .forEach((k) => {
      const s = locByKey.get(k.l), t = prodByKey.get(k.p);
      if (s && t) addLink(s, t, Number(k.v || 0), COL.node);
    });
  // products -> issues
  products.forEach((p, i) => addLink(prod[i], iss[0], Number(p.issues || 0), COL.issues));

  // Compute ribbon paths once (advances node edge cursors in link order).
  links.forEach((lk) => { lk.path = band(lk); });

  // Build labels (names above middle nodes, totals on the ends).
  const labels: Array<{ x: number; y: number; anchor: "start" | "end" | "middle"; text: string; size: number; weight: number; muted?: boolean; tabular?: boolean }> = [];
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: v % 1 === 0 ? 0 : 2 });
  // source labels (left)
  labels.push({ x: xs[0] - 6, y: src[0].y + src[0].h / 2 - 1, anchor: "end", text: "GRN", size: 11, weight: 700 });
  labels.push({ x: xs[0] - 6, y: src[0].y + src[0].h / 2 + 10, anchor: "end", text: fmt(totalGrn), size: 10, weight: 400, muted: true, tabular: true });
  labels.push({ x: xs[0] - 6, y: src[1].y + src[1].h / 2 - 1, anchor: "end", text: "Returns", size: 11, weight: 700 });
  labels.push({ x: xs[0] - 6, y: src[1].y + src[1].h / 2 + 10, anchor: "end", text: fmt(totalReturns), size: 10, weight: 400, muted: true, tabular: true });
  // issues label (right)
  labels.push({ x: xs[3] + nodeW + 6, y: iss[0].y + iss[0].h / 2 - 1, anchor: "start", text: "Issues", size: 11, weight: 700 });
  labels.push({ x: xs[3] + nodeW + 6, y: iss[0].y + iss[0].h / 2 + 10, anchor: "start", text: fmt(totalIssues), size: 10, weight: 400, muted: true, tabular: true });
  // middle node names — above each node, small
  loc.forEach((n) => labels.push({ x: n.x + nodeW / 2, y: n.y - 3, anchor: "middle", text: truncate(n.name, 16), size: 9, weight: 600 }));
  prod.forEach((n) => labels.push({ x: n.x + nodeW / 2, y: n.y - 3, anchor: "middle", text: truncate(n.name, 16), size: 9, weight: 600 }));

  return { W, H, nodeW, cols: [src, loc, prod, iss], links, labels, totalIssues };
}

function band(lk: RLink): string {
  const { s, t } = lk;
  const th = lk.v;
  const x0 = s.x + 12; // nodeW
  const y0 = s.outCur;
  const x1 = t.x;
  const y1 = t.inCur;
  s.outCur += th;
  t.inCur += th;
  const cx = (x0 + x1) / 2;
  return `M ${x0} ${y0} C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1} L ${x1} ${y1 + th} C ${cx} ${y1 + th}, ${cx} ${y0 + th}, ${x0} ${y0 + th} Z`;
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
