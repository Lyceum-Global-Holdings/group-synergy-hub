/**
 * Dual quantity helpers.
 *
 * Items may opt into a secondary unit of measure (e.g. pieces alongside
 * metres). The base UOM is canonical for valuation/FIFO; the secondary
 * UOM is a counted unit captured per receipt. Per-piece size can vary,
 * so the conversion is stored on each transaction — not on the item.
 */

import { formatQty } from "./quantityInput";

export interface DualQty {
  base: number | null;
  secondary?: number | null;
}

/**
 * Render a dual quantity as "120 m (8 pcs)". Falls back gracefully when
 * the secondary side is missing or the item doesn't track it.
 */
export function formatDualQty(
  base: number | string | null | undefined,
  baseUom?: string | null,
  secondary?: number | string | null | undefined,
  secondaryUom?: string | null,
): string {
  const baseStr = formatQty(base);
  const baseLabel = baseUom ? `${baseStr} ${baseUom}` : baseStr;
  if (secondary === null || secondary === undefined || secondary === "") {
    return baseLabel;
  }
  const secStr = formatQty(secondary);
  const secLabel = secondaryUom ? `${secStr} ${secondaryUom}` : secStr;
  return `${baseLabel} (${secLabel})`;
}

/**
 * Compute a per-piece average for display (e.g. "avg 11.111 m / pcs").
 * Returns null when either side is missing or zero.
 */
export function avgPerPiece(
  base: number | string | null | undefined,
  secondary: number | string | null | undefined,
): number | null {
  const b = typeof base === "number" ? base : parseFloat(String(base ?? ""));
  const s = typeof secondary === "number" ? secondary : parseFloat(String(secondary ?? ""));
  if (!Number.isFinite(b) || !Number.isFinite(s) || s === 0) return null;
  return b / s;
}
