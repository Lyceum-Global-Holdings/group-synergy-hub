/**
 * Quantity input standard (international ERP convention).
 *
 * Inventory quantities use up to 3 decimal places to support fractional
 * units of measure such as kilograms, litres, metres and hours. This
 * matches SAP MM (DEC 13,3) and Oracle EBS inventory transactions.
 *
 * Money / value fields (unit_cost, selling_price, etc.) keep 2 decimal
 * places and are unaffected by this helper.
 */

export const QTY_STEP = "0.001";
export const QTY_DECIMALS = 3;
export const QTY_MIN = "0";

/**
 * Format a quantity for display. Trailing zeros are trimmed so that
 * `12` renders as "12" and `12.5` as "12.5", while `0.001` is preserved.
 */
export function formatQty(
  value: number | string | null | undefined,
  decimals: number = QTY_DECIMALS,
): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parse a user-entered quantity string into a number, rounded to the
 * configured precision. Returns `null` for empty / invalid input.
 */
export function parseQty(
  value: string | number | null | undefined,
  decimals: number = QTY_DECIMALS,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
