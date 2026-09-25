import { describe, it, expect, vi, beforeEach } from "vitest";

// Fake Data API: `total` rows, pages capped at `maxRows` like PostgREST's "Max rows".
const server = { total: 0, maxRows: 1000, calls: [] as Array<[number, number]>, fail: false };
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: () => ({
      range: (from: number, to: number) => {
        server.calls.push([from, to]);
        if (server.fail) return Promise.resolve({ data: null, error: { message: "boom", code: "42501" } });
        const end = Math.min(server.total, to + 1, from + server.maxRows);
        const data = Array.from({ length: Math.max(end - from, 0) }, (_, i) => ({ n: from + i }));
        return Promise.resolve({ data, error: null });
      },
    }),
  },
}));

import { beginReportRun, rpcAll } from "../rpcAll";

beforeEach(() => {
  Object.assign(server, { total: 0, maxRows: 1000, calls: [], fail: false });
});

describe("rpcAll", () => {
  it("pages past the 1,000-row API cap and returns every row in order", async () => {
    server.total = 3500;
    const r = await rpcAll("report_x", {});
    expect(r.data).toHaveLength(3500);
    expect(r.data!.map((x) => x.n)).toEqual(Array.from({ length: 3500 }, (_, i) => i));
    expect(r.truncated).toBe(false);
    expect(server.calls).toEqual([[0, 9999], [1000, 9999], [2000, 9999], [3000, 9999]]);
  });

  it("stops at 10,000 rows and flags the run as truncated", async () => {
    server.total = 12_345;
    const run = beginReportRun();
    const r = await rpcAll("report_x", {});
    expect(r.data).toHaveLength(10_000);
    expect(r.truncated).toBe(true);
    expect(run.truncated).toBe(true);
    expect(server.calls).toHaveLength(10);
  });

  it("uses a single request when the server allows large pages", async () => {
    server.total = 4200;
    server.maxRows = 10_000;
    const r = await rpcAll("report_x", {});
    expect(r.data).toHaveLength(4200);
    // one full request + one empty probe (a short first page can't prove the end on its own)
    expect(server.calls).toEqual([[0, 9999], [4200, 9999]]);
  });

  it("handles exactly one page and empty results", async () => {
    server.total = 1000;
    expect((await rpcAll("report_x", {})).data).toHaveLength(1000);
    server.total = 0;
    server.calls = [];
    const empty = await rpcAll("report_x", {});
    expect(empty.data).toEqual([]);
    expect(server.calls).toHaveLength(1);
  });

  it("returns the error from the database", async () => {
    server.fail = true;
    const r = await rpcAll("report_x", {});
    expect(r.data).toBeNull();
    expect(r.error?.code).toBe("42501");
  });
});
