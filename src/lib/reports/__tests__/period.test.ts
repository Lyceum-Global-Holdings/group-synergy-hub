import { describe, it, expect } from "vitest";
import { parseIsoDate, subtractMonths, toIsoDate, trailingMonths } from "../period";

const d = (s: string) => parseIsoDate(s);

describe("subtractMonths (PostgreSQL date - interval semantics)", () => {
  it("clamps to the last day of a shorter month", () => {
    expect(toIsoDate(subtractMonths(d("2026-03-31"), 1))).toBe("2026-02-28");
    expect(toIsoDate(subtractMonths(d("2024-03-31"), 1))).toBe("2024-02-29"); // leap year
    expect(toIsoDate(subtractMonths(d("2026-05-31"), 3))).toBe("2026-02-28");
  });

  it("crosses year boundaries", () => {
    expect(toIsoDate(subtractMonths(d("2026-01-15"), 1))).toBe("2025-12-15");
    expect(toIsoDate(subtractMonths(d("2026-09-25"), 12))).toBe("2025-09-25");
  });
});

describe("trailingMonths — (asOf − PnM, asOf] as inclusive dates", () => {
  it("covers exactly the window the SQL reports use", () => {
    expect(trailingMonths(1, d("2026-09-25"))).toEqual({ from: "2026-08-26", to: "2026-09-25" });
    expect(trailingMonths(12, d("2026-09-25"))).toEqual({ from: "2025-09-26", to: "2026-09-25" });
  });

  it("handles month-end as-of dates", () => {
    expect(trailingMonths(1, d("2026-03-31"))).toEqual({ from: "2026-03-01", to: "2026-03-31" });
    expect(trailingMonths(12, d("2024-02-29"))).toEqual({ from: "2023-03-01", to: "2024-02-29" });
  });
});

describe("toIsoDate / parseIsoDate", () => {
  it("round-trips local calendar dates without a UTC shift", () => {
    expect(toIsoDate(parseIsoDate("2026-01-01"))).toBe("2026-01-01");
    expect(toIsoDate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});
