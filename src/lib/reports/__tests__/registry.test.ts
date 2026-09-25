import { describe, it, expect } from "vitest";
import { REPORT_REGISTRY, getReport } from "../registry";
import dispatcherSource from "@/hooks/reports/useReportData.ts?raw";

describe("report registry integrity", () => {
  it("has unique report codes", () => {
    const codes = REPORT_REGISTRY.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("has unique column keys within each report", () => {
    for (const r of REPORT_REGISTRY) {
      const keys = r.columns.map((c) => c.key);
      expect(new Set(keys).size, r.code).toBe(keys.length);
    }
  });

  it("routes every hookId through the dispatcher", () => {
    for (const r of REPORT_REGISTRY) {
      expect(dispatcherSource.includes(`case "${r.hookId}"`), `${r.code} → ${r.hookId}`).toBe(true);
    }
  });
});

describe("purchase price intelligence reports", () => {
  const codes = ["PR-PRC-TRD-001", "PR-PRC-HIS-001", "PR-PRC-SUP-001"];

  it("are registered under Procurement → Price Intelligence with methodology", () => {
    for (const code of codes) {
      const r = getReport(code);
      expect(r, code).toBeDefined();
      expect(r!.moduleKey).toBe("procurement");
      expect(r!.group).toBe("Price Intelligence");
      expect(r!.methodology?.length ?? 0).toBeGreaterThan(3);
      expect(r!.parameters.find((p) => p.key === "basis")?.type).toBe("select");
    }
  });

  it("trend report exposes every 1/3/6/12-month window", () => {
    const keys = getReport("PR-PRC-TRD-001")!.columns.map((c) => c.key);
    for (const m of [1, 3, 6, 12]) {
      expect(keys).toContain(`qty_${m}m`);
      expect(keys).toContain(`wap_${m}m`);
    }
  });
});
