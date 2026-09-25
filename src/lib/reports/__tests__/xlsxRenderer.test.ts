import { describe, it, expect, vi, afterEach } from "vitest";
import ExcelJS from "exceljs";
import { renderXlsx } from "../xlsxRenderer";
import { getReport } from "../registry";
import type { ReportEnvelope } from "../types";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function envelope(): ReportEnvelope {
  const def = getReport("PR-SPND-001")!;
  return {
    reportCode: def.code, title: def.title, moduleKey: def.moduleKey, companyName: "Test Co", currency: "LKR",
    periodStart: "2025-09-26", periodEnd: "2026-09-25", filters: [], generatedBy: "t", generatedAt: "2026-09-25T00:00:00Z",
    columns: def.columns,
    rows: [{ period_month: "2026-01", supplier_name: "A", po_count: 2, total_qty: 10, total_spend: 1000, currency: "LKR" }],
  };
}

/** Run the renderer and read back the workbook it tried to download. */
async function render(visuals?: Parameters<typeof renderXlsx>[2]) {
  let blob: Blob | undefined;
  const create = vi.fn((b: Blob) => {
    blob = b;
    return "blob:test";
  });
  const RealURL = URL;
  vi.stubGlobal(
    "URL",
    class extends RealURL {
      static createObjectURL = create;
      static revokeObjectURL = vi.fn();
    },
  );
  await renderXlsx(envelope(), "t.xlsx", visuals);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob!.arrayBuffer());
  return wb;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("renderXlsx charts sheet", () => {
  it("adds a Charts sheet with KPIs and images, and opens on it", async () => {
    const wb = await render({
      kpis: [{ label: "Total spend", value: "LKR 1,000.00" }],
      charts: [
        { title: "Monthly spend by supplier", png: PNG, width: 640, height: 300 },
        { title: "Top suppliers by spend", png: PNG, width: 640, height: 300 },
      ],
    });
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Spend Analysis (by supplier × m", "Charts"]);
    const charts = wb.getWorksheet("Charts")!;
    expect(charts.getCell("A4").value).toBe("Total spend");
    expect(charts.getCell("B4").value).toBe("LKR 1,000.00");
    expect(charts.getImages()).toHaveLength(2);
    expect(wb.views?.[0]?.activeTab).toBe(1);
  });

  it("stays data-only without visuals", async () => {
    const wb = await render();
    expect(wb.worksheets).toHaveLength(1);
  });
});
