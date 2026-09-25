import { describe, it, expect } from "vitest";
import { REPORT_REGISTRY } from "../../registry";
import { resolveVisuals } from "..";
import type { ReportEnvelope } from "../../types";
import { renderChartMarkup } from "@/components/management/reports/charts/exportVisuals";

/** Deterministic sample rows shaped like each report's columns. */
function sampleEnvelope(code: string): ReportEnvelope {
  const def = REPORT_REGISTRY.find((r) => r.code === code)!;
  const rows = Array.from({ length: 24 }, (_, i) =>
    Object.fromEntries(
      def.columns.map((c) => {
        switch (c.type) {
          case "date":
          case "datetime":
            return [c.key, `2026-${String((i % 9) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`];
          case "percent":
            return [c.key, ((i % 7) - 3) / 20];
          case "currency":
          case "number":
          case "integer":
            return [c.key, (i + 1) * 137.5 * (c.key.includes("variance") && i % 3 === 0 ? -1 : 1)];
          default:
            return [c.key, c.key.includes("month") ? `2026-${String((i % 6) + 1).padStart(2, "0")}` : `${c.label} ${i % (4 + (c.key.length % 5))}`];
        }
      }),
    ),
  );
  return {
    reportCode: def.code, title: def.title, moduleKey: def.moduleKey, companyName: "Test", currency: "LKR",
    filters: [], generatedBy: "t", generatedAt: "2026-09-25T00:00:00Z", columns: def.columns, rows,
  };
}

describe("visuals for every registered report", () => {
  it("curated charts only reference columns that exist", () => {
    for (const r of REPORT_REGISTRY.filter((x) => x.visuals)) {
      const keys = new Set(r.columns.map((c) => c.key));
      for (const c of r.visuals!.charts) {
        if (c.kind !== "measureColumns") expect(keys.has(c.x), `${r.code}:${c.id} x=${c.x}`).toBe(true);
        c.measures.forEach((m) => expect(keys.has(m.key), `${r.code}:${c.id} ${m.key}`).toBe(true));
        if (c.series) expect(keys.has(c.series), `${r.code}:${c.id} series`).toBe(true);
        if (c.sortBy) expect(keys.has(c.sortBy), `${r.code}:${c.id} sortBy`).toBe(true);
      }
      for (const k of r.visuals!.kpis ?? []) if (k.key) expect(keys.has(k.key), `${r.code} kpi ${k.key}`).toBe(true);
    }
  });

  it.each(REPORT_REGISTRY.map((r) => r.code))("%s renders KPIs and valid SVG charts", (code) => {
    const env = sampleEnvelope(code);
    const v = resolveVisuals(env);
    expect(v.kpis.length).toBeGreaterThan(0);
    v.kpis.forEach((k) => expect(Number.isFinite(k.value), `${code} ${k.label}`).toBe(true));
    const { charts } = renderChartMarkup(env);
    for (const c of charts) {
      expect(c.svg.startsWith("<svg")).toBe(true);
      expect(c.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(c.svg, `${code} ${c.title}`).not.toMatch(/NaN|Infinity|undefined/);
      expect(c.height).toBeGreaterThan(0);
    }
  });

  it("derives sensible defaults for an un-curated report (Stock on Hand)", () => {
    const v = resolveVisuals(sampleEnvelope("WH-STK-OH-001"));
    const top = v.charts.find((c) => c.spec.id === "auto-top");
    expect(top?.spec.x).toBe("item_name");
    expect(top?.spec.measures[0].key).toBe("stock_value");
    expect(v.kpis.map((k) => k.label)).toEqual(expect.arrayContaining(["Total stock value", "Items"]));
    expect(top?.spec.title).toBe("Top items by stock value");
  });
});
