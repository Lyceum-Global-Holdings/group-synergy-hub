import type { ReportColumn, ReportEnvelope } from "../types";
import type { ChartSpec, KpiSpec, VisualSpec } from "./types";
import { dateKey, toNumber } from "./data";

// Columns whose values don't add up meaningfully (unit prices, rates, ratios,
// day counts…) are never summed into totals or bar heights.
const NON_ADDITIVE =
  /(unit_cost|unit_price|_price|price_|rate|avg|wap|pct|percent|score|rating|^min_|^max_|last_|fx_|temperature|sequence|size_value|days|validity|useful_life|rank|_share)/;

// Preferred "headline" measure, in order.
const MEASURE_PREFERENCE = [/total/, /value/, /spend/, /amount/, /outstanding/, /balance/, /cost/, /freight/, /debit/, /qty|quantity/, /stock/, /count/, /output|input|wastage/, /pieces/];

const CODE_LIKE = /(_code$|_number$|^.*_id$|serial|tag$|batch|reference|email|notes|description|details|user_agent|currency|uom$|unit_name|size_uom|bin_name|bin_code|_path$|^title$|remarks)/;
const NAME_LIKE = /((^|_)name$|_title$)/;
const CATEGORICAL = /(status|state|type|bucket|class|category|priority|result|direction|condition|format|module|source|stage|department|reason)/;

const isNumeric = (c: ReportColumn) => c.type === "currency" || c.type === "number" || c.type === "integer";
const isDate = (c: ReportColumn) => c.type === "date" || c.type === "datetime";

function distinctCount(rows: Record<string, unknown>[], key: string, cap = 50): number {
  const seen = new Set<string>();
  for (const r of rows) {
    const v = r[key];
    if (v === null || v === undefined || v === "") continue;
    seen.add(String(v));
    if (seen.size > cap) break;
  }
  return seen.size;
}

function pickByPreference(cols: ReportColumn[]): ReportColumn | undefined {
  for (const re of MEASURE_PREFERENCE) {
    const hit = cols.find((c) => re.test(c.key));
    if (hit) return hit;
  }
  return cols[0];
}

/** "Item Name" → "items", "Category" → "categories", "Supplier" → "suppliers". */
export function nounOf(label: string) {
  const l = label.replace(/\s+name$/i, "").trim().toLowerCase();
  if (l.endsWith("s")) return l;
  if (/[^aeiou]y$/.test(l)) return `${l.slice(0, -1)}ies`;
  return `${l}s`;
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/**
 * Derive KPI tiles and up to three charts from a report's columns and data:
 *   1. trend of the headline measure (or record count) over the first date column
 *   2. top 10 of the main name-like dimension by that measure
 *   3. share by a short categorical column (status, type, bucket…)
 */
export function autoVisuals(env: Pick<ReportEnvelope, "columns" | "rows">): VisualSpec {
  const { columns, rows } = env;
  const additive = columns.filter((c) => isNumeric(c) && !NON_ADDITIVE.test(c.key));
  const currencyMeasures = additive.filter((c) => c.type === "currency");
  const measure = pickByPreference(currencyMeasures) ?? pickByPreference(additive.filter((c) => c.type !== "currency"));

  const strings = columns.filter((c) => !c.type || c.type === "string");
  const monthStrings = strings.filter((c) => rows.slice(0, 20).some((r) => /^\d{4}-\d{2}$/.test(String(r[c.key] ?? ""))));
  const dateCol = columns.find(isDate) ?? monthStrings[0];

  const nameCol =
    strings.find((c) => NAME_LIKE.test(c.key) && !monthStrings.includes(c)) ??
    strings.find((c) => !CODE_LIKE.test(c.key) && !CATEGORICAL.test(c.key) && !monthStrings.includes(c) && distinctCount(rows, c.key) > 8);

  const catCol = strings
    .filter((c) => c !== nameCol && !monthStrings.includes(c) && !CODE_LIKE.test(c.key))
    .sort((a, b) => Number(CATEGORICAL.test(b.key)) - Number(CATEGORICAL.test(a.key)))
    .find((c) => {
      const n = distinctCount(rows, c.key, 10);
      return n >= 2 && n <= 8;
    });

  const m = measure ? [{ key: measure.key }] : [{ key: columns[0]?.key ?? "", agg: "count" as const }];
  const mLabel = measure ? sentence(measure.label) : "Records";
  const charts: ChartSpec[] = [];

  if (dateCol) {
    const keys = rows.map((r) => dateKey(r[dateCol.key], "day")).filter(Boolean) as string[];
    if (keys.length) {
      keys.sort();
      const spanDays = (Date.parse(keys[keys.length - 1]) - Date.parse(keys[0])) / 86_400_000;
      const bucket: "day" | "month" = monthStrings.includes(dateCol) || spanDays > 45 ? "month" : "day";
      const buckets = new Set(rows.map((r) => dateKey(r[dateCol.key], bucket)).filter(Boolean)).size;
      if (buckets >= 2) {
        charts.push({
          id: "auto-trend",
          kind: buckets > 24 ? "line" : "column",
          title: `${mLabel} by ${bucket === "month" ? "month" : "day"}`,
          subtitle: `By ${dateCol.label.toLowerCase()}`,
          x: dateCol.key,
          xTime: bucket,
          measures: m,
        });
      }
    }
  }

  if (nameCol && distinctCount(rows, nameCol.key) >= 2) {
    charts.push({
      id: "auto-top",
      kind: "hbar",
      title: `Top ${nounOf(nameCol.label)} by ${mLabel.toLowerCase()}`,
      x: nameCol.key,
      measures: m,
      limit: 10,
    });
  }

  if (catCol) {
    const nonNegative = !measure || rows.every((r) => (toNumber(r[measure.key]) ?? 0) >= 0);
    const donutMeasure = nonNegative ? m : [{ key: columns[0].key, agg: "count" as const }];
    charts.push({
      id: "auto-share",
      kind: "donut",
      title: `${nonNegative ? mLabel : "Records"} by ${catCol.label.toLowerCase()}`,
      x: catCol.key,
      measures: donutMeasure,
    });
  }

  const kpis: KpiSpec[] = [{ label: "Records", agg: "rows" }];
  if (measure) {
    kpis.push({ label: /^total/i.test(measure.label) ? measure.label : `Total ${measure.label.toLowerCase()}`, agg: "sum", key: measure.key });
    const second = currencyMeasures.find((c) => c !== measure);
    if (second) kpis.push({ label: `Total ${second.label.toLowerCase()}`, agg: "sum", key: second.key });
  }
  if (nameCol) kpis.push({ label: sentence(nounOf(nameCol.label)), agg: "distinct", key: nameCol.key });

  return { kpis: kpis.slice(0, 4), charts: charts.slice(0, 3) };
}
