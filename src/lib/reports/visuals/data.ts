import type { ReportColumn, ReportEnvelope } from "../types";
import type { Agg, ChartData, ChartSpec, Kpi, KpiSpec, ValueFormat } from "./types";

export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function columnOf(env: Pick<ReportEnvelope, "columns">, key: string): ReportColumn | undefined {
  return env.columns.find((c) => c.key === key);
}

export function formatOf(col?: ReportColumn): ValueFormat {
  switch (col?.type) {
    case "currency":
      return "currency";
    case "percent":
      return "percent";
    case "integer":
      return "integer";
    default:
      return "number";
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ISO date / timestamp / "YYYY-MM" → bucket key ("YYYY-MM" or "YYYY-MM-DD"). */
export function dateKey(v: unknown, bucket: "day" | "month"): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v);
  if (/^\d{4}-\d{2}$/.test(s)) return s; // already a month
  let day = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
  if (!day) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    day = d.toISOString().slice(0, 10);
  }
  return bucket === "month" ? day.slice(0, 7) : day;
}

export function dateKeyLabel(key: string): string {
  const [y, m, d] = key.split("-");
  const mon = MONTHS[Number(m) - 1] ?? m;
  return d ? `${Number(d)} ${mon}` : `${mon} ${y}`;
}

function nextKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (d === undefined) return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/** Fill gaps so a trend shows empty months/days as zero instead of skipping them. */
function fillTimeGaps(keys: string[], maxSteps: number): string[] {
  if (keys.length < 2) return keys;
  const out: string[] = [];
  let k = keys[0];
  const last = keys[keys.length - 1];
  while (out.length <= maxSteps) {
    out.push(k);
    if (k === last) return out;
    k = nextKey(k);
  }
  return keys; // span too long — keep only the buckets that have data
}

class Acc {
  sum = 0;
  n = 0;
  min = Infinity;
  max = -Infinity;
  rows = 0;
  add(v: number | null) {
    this.rows += 1;
    if (v === null) return;
    this.sum += v;
    this.n += 1;
    if (v < this.min) this.min = v;
    if (v > this.max) this.max = v;
  }
  value(agg: Agg): number {
    switch (agg) {
      case "count":
        return this.rows;
      case "avg":
        return this.n ? this.sum / this.n : 0;
      case "min":
        return this.n ? this.min : 0;
      case "max":
        return this.n ? this.max : 0;
      default:
        return this.sum;
    }
  }
}

/** Snake-case enum values read better as words: "out_of_stock" → "Out of stock". */
function humanize(v: string) {
  return /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(v) ? (v.charAt(0).toUpperCase() + v.slice(1)).replace(/_/g, " ") : v;
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * Aggregate report rows into chart-ready categories × series according to a
 * spec. Pure and deterministic — shared by the on-screen charts and exports.
 */
export function buildChartData(env: Pick<ReportEnvelope, "columns" | "rows">, spec: ChartSpec): ChartData {
  const rows = env.rows;
  const firstMeasure = spec.measures[0];
  const format: ValueFormat =
    firstMeasure && (firstMeasure.agg ?? "sum") === "count" ? "integer" : formatOf(firstMeasure ? columnOf(env, firstMeasure.key) : undefined);

  // One bar per measure, aggregated over everything.
  if (spec.kind === "measureColumns") {
    const values = spec.measures.map((m) => {
      const acc = new Acc();
      rows.forEach((r) => acc.add(toNumber(r[m.key])));
      return acc.value(m.agg ?? "sum");
    });
    const labels = spec.measures.map((m) => m.label ?? columnOf(env, m.key)?.label ?? m.key);
    return { categories: labels, fullCategories: labels, series: [{ name: "Total", values }], format, time: false };
  }

  const time = !!spec.xTime;
  const catKey = (r: Record<string, unknown>): string | null => {
    const v = r[spec.x];
    if (time) return dateKey(v, spec.xTime!);
    return v === null || v === undefined || v === "" ? "—" : String(v);
  };

  const splitBySeries = spec.kind === "stacked" && !!spec.series;
  const seriesNames: string[] = splitBySeries
    ? []
    : spec.measures.map((m) => m.label ?? columnOf(env, m.key)?.label ?? m.key);

  // cat → series → accumulator
  const cells = new Map<string, Map<string, Acc>>();
  const rankTotals = new Map<string, number>();
  const seriesTotals = new Map<string, number>();

  for (const r of rows) {
    const c = catKey(r);
    if (c === null) continue;
    let bucket = cells.get(c);
    if (!bucket) cells.set(c, (bucket = new Map()));

    if (splitBySeries) {
      const s = r[spec.series!];
      const sName = s === null || s === undefined || s === "" ? "—" : String(s);
      const v = toNumber(r[firstMeasure.key]);
      let acc = bucket.get(sName);
      if (!acc) bucket.set(sName, (acc = new Acc()));
      acc.add(v);
      seriesTotals.set(sName, (seriesTotals.get(sName) ?? 0) + (v ?? 0));
    } else {
      spec.measures.forEach((m, i) => {
        const name = seriesNames[i];
        let acc = bucket!.get(name);
        if (!acc) bucket!.set(name, (acc = new Acc()));
        acc.add(toNumber(r[m.key]));
      });
    }
    const rankVal = spec.sortBy ? toNumber(r[spec.sortBy]) ?? 0 : null;
    if (rankVal !== null) rankTotals.set(c, (rankTotals.get(c) ?? 0) + rankVal);
  }

  const seriesAgg = (name: string): Agg => {
    if (splitBySeries) return firstMeasure.agg ?? "sum";
    const i = seriesNames.indexOf(name);
    return spec.measures[i]?.agg ?? "sum";
  };

  // Series list (stacked by column: top N + Other)
  let series: string[] = seriesNames;
  let otherSeries: Set<string> | null = null;
  if (splitBySeries) {
    const ranked = [...seriesTotals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const limit = spec.seriesLimit ?? 5;
    series = ranked.slice(0, limit);
    if (ranked.length > limit) {
      otherSeries = new Set(ranked.slice(limit));
      series.push("Other");
    }
  }

  const valueAt = (cat: string, s: string): number => {
    const bucket = cells.get(cat);
    if (!bucket) return 0;
    if (s === "Other" && otherSeries) {
      let total = 0;
      otherSeries.forEach((o) => (total += bucket.get(o)?.value(seriesAgg(o)) ?? 0));
      return total;
    }
    return bucket.get(s)?.value(seriesAgg(s)) ?? 0;
  };

  // Category order
  let cats = [...cells.keys()];
  if (time) {
    cats.sort();
    cats = fillTimeGaps(cats, spec.xTime === "month" ? 60 : 92);
  } else {
    const rank = (c: string) =>
      spec.sortBy ? rankTotals.get(c) ?? 0 : series.reduce((t, s, i) => t + (i === 0 || spec.kind === "stacked" ? valueAt(c, s) : 0), 0);
    const dir = spec.sort ?? "value-desc";
    cats.sort((a, b) =>
      dir === "value-asc" ? rank(a) - rank(b) : dir === "abs-desc" ? Math.abs(rank(b)) - Math.abs(rank(a)) : rank(b) - rank(a),
    );
    const limit = spec.limit ?? (spec.kind === "donut" ? 6 : 10);
    if (cats.length > limit) {
      const kept = cats.slice(0, limit);
      // Donuts keep the remainder as "Other" so shares still add up to 100%.
      if (spec.kind === "donut" && ["sum", "count"].includes(firstMeasure?.agg ?? "sum")) {
        const rest = cats.slice(limit);
        const otherVal = rest.reduce((t, c) => t + valueAt(c, series[0]), 0);
        const values = kept.map((c) => valueAt(c, series[0]));
        const labels = [...kept.map(humanize), "Other"];
        return {
          categories: labels.map((l) => truncate(l, 28)),
          fullCategories: labels,
          series: [{ name: series[0], values: [...values, otherVal] }],
          format,
          time,
        };
      }
      cats = kept;
    }
  }

  const labels = time ? cats.map(dateKeyLabel) : cats.map(humanize);
  return {
    categories: labels.map((l) => truncate(l, 28)),
    fullCategories: labels,
    series: series.map((s) => ({ name: s, values: cats.map((c) => valueAt(c, s)) })),
    format,
    time,
  };
}

export function computeKpis(env: Pick<ReportEnvelope, "columns" | "rows">, specs: KpiSpec[]): Kpi[] {
  return specs.map((k) => {
    if (k.agg === "rows") return { label: k.label, value: env.rows.length, format: "integer" as const };
    if (k.agg === "distinct") {
      const set = new Set(env.rows.map((r) => r[k.key!]).filter((v) => v !== null && v !== undefined && v !== ""));
      return { label: k.label, value: set.size, format: "integer" as const };
    }
    const acc = new Acc();
    env.rows.forEach((r) => acc.add(toNumber(r[k.key!])));
    return {
      label: k.label,
      value: acc.value(k.agg),
      format: k.agg === "count" ? "integer" : formatOf(columnOf(env, k.key!)),
    };
  });
}

/** Compact number for axes and bar labels: 1.2M, 45.3k, 12.5%. */
export function formatCompact(v: number, format: ValueFormat, currency?: string): string {
  if (format === "percent") return `${(v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0)}%`;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const short =
    abs >= 1e9 ? `${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`
    : abs >= 1e6 ? `${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`
    : abs >= 1e3 ? `${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`
    : format === "integer" ? `${Math.round(abs)}`
    : `${Number(abs.toFixed(abs < 10 ? 2 : 1))}`;
  return format === "currency" && currency ? `${sign}${currency} ${short}` : `${sign}${short}`;
}

/** Full value for KPI tiles and tooltips. */
export function formatFull(v: number, format: ValueFormat, currency?: string): string {
  switch (format) {
    case "percent":
      return `${(v * 100).toFixed(1)}%`;
    case "integer":
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
    case "currency":
      return `${currency ?? ""} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`.trim();
    default:
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);
  }
}
