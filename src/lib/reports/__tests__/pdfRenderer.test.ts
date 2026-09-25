import { describe, it, expect, vi } from "vitest";
import type { jsPDF } from "jspdf";
import { renderPdf } from "../pdfRenderer";
import { getReport } from "../registry";
import type { ReportEnvelope } from "../types";

// Wrap the real constructor so save() captures the document instead of downloading.
const saved = vi.hoisted(() => [] as unknown[]);
vi.mock("jspdf", async (importOriginal) => {
  const actual: any = await importOriginal();
  function Capturing(...args: any[]) {
    const doc = new actual.jsPDF(...args);
    doc.save = () => {
      saved.push(doc);
      return doc;
    };
    return doc;
  }
  Capturing.API = actual.jsPDF.API;
  return { ...actual, default: Capturing, jsPDF: Capturing };
});

function envelopeFor(code: string, rows: number, notes?: string[]): ReportEnvelope {
  const def = getReport(code)!;
  return {
    reportCode: def.code,
    title: def.title,
    moduleKey: def.moduleKey,
    standard: def.standard,
    companyName: "Test Co",
    currency: "LKR",
    periodStart: "2025-09-26",
    periodEnd: "2026-09-25",
    filters: [],
    generatedBy: "tester",
    generatedAt: "2026-09-25T00:00:00Z",
    columns: def.columns,
    rows: Array.from({ length: rows }, (_, i) =>
      Object.fromEntries(
        def.columns.map((c) => [
          c.key,
          c.type === "string" ? `v${i}` : c.type === "date" ? "2026-09-01" : i + 0.5,
        ]),
      ),
    ),
    notes: notes ?? def.methodology,
  };
}

async function capture(env: ReportEnvelope) {
  await renderPdf(env, "test.pdf");
  return saved.at(-1) as jsPDF;
}

describe("renderPdf", () => {
  it("uses A3 landscape for the 23-column price trend and prints methodology", async () => {
    const doc = await capture(envelopeFor("PR-PRC-TRD-001", 5));
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(1191); // A3 landscape
    const text = doc.output();
    expect(text).toContain("Methodology");
    expect(text).toContain("IAS 2");
  });

  it("keeps A4 for narrow reports", async () => {
    const doc = await capture(envelopeFor("PR-SPND-001", 3, []));
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(595); // A4 portrait
  });

  it("continues long methodology onto a new page", async () => {
    const doc = await capture(envelopeFor("PR-PRC-HIS-001", 40, Array.from({ length: 60 }, (_, i) => `Note ${i} `.repeat(20))));
    const pagesWithRowsOnly = await capture(envelopeFor("PR-PRC-HIS-001", 40, []));
    expect(doc.getNumberOfPages()).toBeGreaterThan(pagesWithRowsOnly.getNumberOfPages());
  });

  it("adds a visual summary (KPI tiles + chart images) before the table", async () => {
    // 1×1 PNG
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const env = envelopeFor("PR-SPND-001", 5, []);
    const plain = await capture(env);
    const withCharts = await (async () => {
      await renderPdf(env, "test.pdf", {
        kpis: [{ label: "Total spend", value: "LKR 1,234.00" }, { label: "Suppliers", value: "4" }],
        charts: [
          { title: "Monthly spend by supplier", png, width: 640, height: 300 },
          { title: "Top suppliers by spend", png, width: 640, height: 328 },
        ],
      });
      return saved.at(-1) as jsPDF;
    })();
    const text = withCharts.output();
    expect(text).toContain("Total spend");
    expect(text).toContain("Monthly spend by supplier");
    expect(text).toContain("Detail");
    expect(text).toMatch(/\/Subtype \/Image/);
    expect(withCharts.getNumberOfPages()).toBeGreaterThanOrEqual(plain.getNumberOfPages());
    expect(text).toContain(`Page 1 of ${withCharts.getNumberOfPages()}`);
  });
});
