// Visual (chart) specifications for Reports Center.
// A report either declares `visuals` in the registry or gets them derived
// from its column metadata (see auto.ts). Specs are pure data so the same
// definition drives the on-screen charts and the PDF / Excel exports.

export type Agg = "sum" | "avg" | "count" | "min" | "max";
export type ValueFormat = "currency" | "number" | "integer" | "percent";

export interface ChartMeasure {
  key: string;
  label?: string;
  agg?: Agg; // default "sum"
}

export interface ChartSpec {
  id: string;
  /**
   * hbar            — ranked horizontal bars (top N)
   * column          — vertical bars; several measures are drawn side by side
   * stacked         — vertical stacked bars (split by `series` column, or by measures)
   * line            — trend line(s)
   * donut           — share of total
   * measureColumns  — one bar per measure, each aggregated over all rows (e.g. aging buckets)
   */
  kind: "hbar" | "column" | "stacked" | "line" | "donut" | "measureColumns";
  title: string;
  subtitle?: string;
  /** Category / time column key. Ignored for measureColumns. */
  x: string;
  /** Bucket the x column as dates (also accepts YYYY-MM strings). */
  xTime?: "day" | "month";
  measures: ChartMeasure[];
  /** stacked only: split each bar by this column's values. */
  series?: string;
  /** Keep the top N categories (by `sortBy`, default the first measure). */
  limit?: number;
  /** stacked with `series`: keep the top N series, fold the rest into "Other". */
  seriesLimit?: number;
  sort?: "value-desc" | "value-asc" | "abs-desc";
  /** Rank categories by this column's sum instead of the first measure. */
  sortBy?: string;
}

export interface KpiSpec {
  label: string;
  /** "rows" counts records; "distinct" counts distinct values of `key`. */
  agg: Agg | "rows" | "distinct";
  key?: string;
}

export interface VisualSpec {
  kpis?: KpiSpec[];
  charts: ChartSpec[];
}

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartData {
  categories: string[];
  /** Full label per category (tooltips); same order as categories. */
  fullCategories: string[];
  series: ChartSeries[];
  format: ValueFormat;
  /** Time-bucketed x axis (drawn in chronological order, gaps filled). */
  time: boolean;
}

export interface Kpi {
  label: string;
  value: number;
  format: ValueFormat;
}

/** Charts rendered to PNG for PDF / Excel output. */
export interface RenderedVisuals {
  kpis: { label: string; value: string }[];
  charts: { title: string; subtitle?: string; png: string; width: number; height: number }[];
}
