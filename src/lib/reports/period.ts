// Period helpers for Reports Center parameters (ISO 8601 calendar dates).

/** Local calendar date as YYYY-MM-DD (not UTC — avoids a day shift east of GMT). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Subtract whole calendar months, clamping to the target month's last day —
 * the same rule as PostgreSQL `date - interval 'N months'`
 * (2026-03-31 − 1 month = 2026-02-28).
 */
export function subtractMonths(date: Date, months: number): Date {
  const y = date.getFullYear();
  const m = date.getMonth() - months;
  const target = new Date(y, m, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

/**
 * The trailing N-month window ending on `asOf`, inclusive of both ends:
 * (asOf − PnM, asOf] → from = asOf − N months + 1 day. Matches the SQL
 * windows used by the purchase price reports.
 */
export function trailingMonths(months: number, asOf: Date = new Date()): { from: string; to: string } {
  const start = subtractMonths(asOf, months);
  start.setDate(start.getDate() + 1);
  return { from: toIsoDate(start), to: toIsoDate(asOf) };
}

/** Parse YYYY-MM-DD as a local date (new Date("YYYY-MM-DD") would be UTC). */
export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const MONTH_PRESETS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
];
