import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { buildReportEnvelope } from "../useReportData";
import { getReport } from "@/lib/reports/registry";

const ctx = {
  companyId: "co-1",
  companyName: "Acme",
  currency: "LKR",
  generatedBy: "tester@example.com",
  filters: [],
};

beforeEach(() => rpc.mockReset());

describe("purchase price report dispatch", () => {
  it("trend: passes filters, totals spend and prints methodology", async () => {
    rpc.mockResolvedValue({ data: [{ item_code: "A", spend_12m: 100 }, { item_code: "B", spend_12m: 50.5 }], error: null });
    const env = await buildReportEnvelope(getReport("PR-PRC-TRD-001")!, ctx, {
      basis: "received",
      asOf: "2026-09-25",
      catalogItemId: "item-1",
      supplierId: "sup-1",
      locationId: "loc-1",
    });
    expect(rpc).toHaveBeenCalledWith("report_purchase_price_trend", {
      p_company_id: "co-1",
      p_basis: "received",
      p_as_of: "2026-09-25",
      p_catalog_item_id: "item-1",
      p_category_id: null,
      p_supplier_id: "sup-1",
      p_location_id: "loc-1",
    });
    expect(env.totals).toEqual({ spend_12m: 150.5 });
    expect(env.periodStart).toBe("2025-09-26");
    expect(env.periodEnd).toBe("2026-09-25");
    expect(env.notes?.some((n) => n.includes("IAS 2 §25"))).toBe(true);
  });

  it("history: ordered basis drops location, notes it, and labels item links", async () => {
    rpc.mockResolvedValue({
      data: [
        { doc_number: "PO-1", unlinked: false, line_value_base: 10 },
        { doc_number: "PO-1", unlinked: true, line_value_base: 5 },
      ],
      error: null,
    });
    const env = await buildReportEnvelope(getReport("PR-PRC-HIS-001")!, ctx, {
      basis: "ordered",
      period: { from: "2026-06-26", to: "2026-09-25" },
      locationId: "loc-1",
    });
    const args = rpc.mock.calls[0][1];
    expect(rpc.mock.calls[0][0]).toBe("report_purchase_history");
    expect(args.p_basis).toBe("ordered");
    expect(args.p_location_id).toBeNull();
    expect(args.p_date_from).toBe("2026-06-26");
    expect(env.rows.map((r) => r.item_link)).toEqual(["Catalog", "Free text"]);
    expect(env.totals).toEqual({ line_value_base: 15 });
    expect(env.notes?.at(-1)).toMatch(/location filter was ignored/);
  });

  it("comparison: defaults to the received basis and never sends a supplier filter", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await buildReportEnvelope(getReport("PR-PRC-SUP-001")!, ctx, { period: { from: "2025-09-26", to: "2026-09-25" } });
    const args = rpc.mock.calls[0][1];
    expect(rpc.mock.calls[0][0]).toBe("report_supplier_price_comparison");
    expect(args.p_basis).toBe("received");
    expect(args).not.toHaveProperty("p_supplier_id");
  });

  it("surfaces access errors from the database", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Not authorised to view purchase prices for this company" } });
    await expect(
      buildReportEnvelope(getReport("PR-PRC-TRD-001")!, ctx, {}),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
