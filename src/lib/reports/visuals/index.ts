import type { ReportEnvelope } from "../types";
import { getReport } from "../registry";
import { autoVisuals } from "./auto";
import { buildChartData, computeKpis } from "./data";
import type { ChartData, ChartSpec, Kpi, VisualSpec } from "./types";

export * from "./types";
export { buildChartData, computeKpis, formatCompact, formatFull } from "./data";

export interface ResolvedVisuals {
  kpis: Kpi[];
  charts: { spec: ChartSpec; data: ChartData }[];
}

/**
 * Curated visuals from the registry when a report declares them, otherwise
 * ones derived from its columns. Charts with nothing to show are dropped.
 */
export function resolveVisuals(env: ReportEnvelope): ResolvedVisuals {
  const curated: VisualSpec | undefined = getReport(env.reportCode)?.visuals;
  const spec = curated ?? autoVisuals(env);
  const kpis = computeKpis(env, spec.kpis ?? autoVisuals(env).kpis ?? []);
  const charts = spec.charts
    .map((c) => ({ spec: c, data: buildChartData(env, c) }))
    .filter(({ data }) => data.categories.length > 0 && data.series.some((s) => s.values.some((v) => v !== 0)));
  return { kpis, charts };
}
