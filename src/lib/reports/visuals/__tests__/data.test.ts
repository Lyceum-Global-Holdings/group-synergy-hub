import { describe, it, expect } from "vitest";
import { buildChartData, computeKpis, formatCompact } from "../data";
import type { ReportColumn } from "../../types";

const columns: ReportColumn[] = [
  { key: "d", label: "Date", type: "date" },
  { key: "supplier", label: "Supplier", type: "string" },
  { key: "status", label: "Status", type: "string" },
  { key: "value", label: "Value", type: "currency" },
];
const rows = [
  { d: "2026-01-15", supplier: "A", status: "open", value: 100 },
  { d: "2026-01-20", supplier: "B", status: "open", value: 50 },
  { d: "2026-03-02", supplier: "A", status: "closed", value: 30 },
  { d: "2026-03-09", supplier: "C", status: "closed", value: 10 },
  { d: "2026-03-10", supplier: "D", status: "void", value: 5 },
];
const env = { columns, rows };

describe("buildChartData", () => {
  it("ranks categories by value and applies the limit", () => {
    const d = buildChartData(env, { id: "t", kind: "hbar", title: "", x: "supplier", measures: [{ key: "value" }], limit: 2 });
    expect(d.categories).toEqual(["A", "B"]);
    expect(d.series[0].values).toEqual([130, 50]);
    expect(d.format).toBe("currency");
  });

  it("buckets dates by month and fills empty months with zero", () => {
    const d = buildChartData(env, { id: "t", kind: "column", title: "", x: "d", xTime: "month", measures: [{ key: "value" }] });
    expect(d.categories).toEqual(["Jan 2026", "Feb 2026", "Mar 2026"]);
    expect(d.series[0].values).toEqual([150, 0, 45]);
    expect(d.time).toBe(true);
  });

  it("stacks by a series column, folding the tail into Other", () => {
    const d = buildChartData(env, { id: "t", kind: "stacked", title: "", x: "d", xTime: "month", series: "supplier", seriesLimit: 2, measures: [{ key: "value" }] });
    expect(d.series.map((s) => s.name)).toEqual(["A", "B", "Other"]);
    expect(d.series.find((s) => s.name === "Other")!.values).toEqual([0, 0, 15]);
  });

  it("keeps donut shares complete with an Other slice", () => {
    const d = buildChartData(env, { id: "t", kind: "donut", title: "", x: "supplier", measures: [{ key: "value" }], limit: 2 });
    expect(d.categories).toEqual(["A", "B", "Other"]);
    expect(d.series[0].values.reduce((a, b) => a + b, 0)).toBe(195);
  });

  it("counts records and sorts by absolute value", () => {
    const counts = buildChartData(env, { id: "t", kind: "donut", title: "", x: "status", measures: [{ key: "value", agg: "count" }] });
    expect(counts.categories[0]).toMatch(/open|closed/);
    expect(counts.format).toBe("integer");
    const abs = buildChartData(
      { columns, rows: [{ supplier: "X", value: -80 }, { supplier: "Y", value: 20 }, { supplier: "Z", value: 50 }] },
      { id: "t", kind: "hbar", title: "", x: "supplier", measures: [{ key: "value" }], sort: "abs-desc" },
    );
    expect(abs.categories).toEqual(["X", "Z", "Y"]);
  });

  it("builds one bar per measure for measureColumns", () => {
    const d = buildChartData(
      { columns: [{ key: "a", label: "0–30", type: "currency" }, { key: "b", label: "31+", type: "currency" }], rows: [{ a: 10, b: 1 }, { a: 5, b: 2 }] },
      { id: "t", kind: "measureColumns", title: "", x: "", measures: [{ key: "a" }, { key: "b", label: "Over 30" }] },
    );
    expect(d.categories).toEqual(["0–30", "Over 30"]);
    expect(d.series[0].values).toEqual([15, 3]);
  });
});

describe("computeKpis / formatting", () => {
  it("computes rows, sums, averages and distinct counts", () => {
    const k = computeKpis(env, [
      { label: "Rows", agg: "rows" },
      { label: "Value", agg: "sum", key: "value" },
      { label: "Avg", agg: "avg", key: "value" },
      { label: "Suppliers", agg: "distinct", key: "supplier" },
    ]);
    expect(k.map((x) => x.value)).toEqual([5, 195, 39, 4]);
    expect(k[1].format).toBe("currency");
  });

  it("formats compact values", () => {
    expect(formatCompact(2_829_656, "currency", "LKR")).toBe("LKR 2.8M");
    expect(formatCompact(-45_300, "number")).toBe("-45k");
    expect(formatCompact(0.1012, "percent")).toBe("10%");
    expect(formatCompact(0.035, "percent")).toBe("3.5%");
  });
});
