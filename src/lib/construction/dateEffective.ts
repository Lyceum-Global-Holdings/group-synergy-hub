/**
 * Date-effective filtering helpers for resource allocation.
 * Implements ISO 21500 / PMI PMBOK time-phased resource availability:
 *
 *   A row is "active on" date D when:
 *     start_date is null OR start_date <= D
 *     AND
 *     end_date   is null OR end_date   >= D
 *
 * Dates compared as ISO 8601 strings (YYYY-MM-DD) — lexicographic
 * comparison is correct and timezone-stable for date-only values.
 */

export interface DateEffectiveRow {
  start_date?: string | null;
  end_date?: string | null;
}

/** Format a Date as a local-time YYYY-MM-DD string (no UTC shift). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string back to a local-midnight Date. Returns null on invalid. */
export function fromIsoDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** Check whether a date-effective row is active on the given as-of ISO date. */
export function isActiveOn<T extends DateEffectiveRow>(row: T, asOfISO: string): boolean {
  const start = row.start_date ?? null;
  const end = row.end_date ?? null;
  if (start && start > asOfISO) return false;
  if (end && end < asOfISO) return false;
  return true;
}

/** True if two Date objects represent the same calendar day in local time. */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
