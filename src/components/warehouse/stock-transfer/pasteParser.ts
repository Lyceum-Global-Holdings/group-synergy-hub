/**
 * Pure parser + resolver for the "Paste transfer items" dialog.
 *
 * Aligns with the project's existing bulk-paste convention
 * (BulkCatalogToInventoryDialog): item_code → barcode/GTIN → sku resolution,
 * TSV/CSV/semicolon tolerant, dedupes by item id (sums quantity).
 *
 * Standards reference: GS1 LIM / EDIFACT INSDES line = { item id, qty, [uom] }.
 */

export interface PasteCatalogItem {
  id: string;
  item_code?: string | null;
  name: string;
  unit_of_measure?: string | null;
  barcode?: string | null;
  sku?: string | null;
}

export type RawPasteRow = {
  lineNumber: number;
  rawLine: string;
  code: string;
  qty: string;
  uom?: string;
};

export type ResolvedStatus = "ok" | "warning" | "error";

export interface ResolvedPasteRow {
  lineNumber: number;
  rawLine: string;
  code: string;
  matchedItem?: PasteCatalogItem;
  quantity: number;
  unit_of_measure: string;
  onHand?: number;
  mergedFromLines?: number[];
  status: ResolvedStatus;
  messages: string[];
}

/**
 * Split a pasted block into raw rows.
 * Accepts tab, comma, or semicolon separators. Blank lines are skipped.
 * Columns: <code> <qty> [uom]
 */
export function parsePastedRows(text: string): RawPasteRow[] {
  const rows: RawPasteRow[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    // Split on tab, comma, or semicolon; collapse runs of whitespace as tab.
    const parts = trimmed
      .split(/\t|,|;/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    // Fallback: if only one token, try splitting on whitespace (Excel single-col paste)
    const tokens =
      parts.length >= 2 ? parts : trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) {
      rows.push({
        lineNumber: idx + 1,
        rawLine,
        code: tokens[0] ?? "",
        qty: "",
      });
      return;
    }
    rows.push({
      lineNumber: idx + 1,
      rawLine,
      code: tokens[0],
      qty: tokens[1],
      uom: tokens[2],
    });
  });
  return rows;
}

/**
 * Resolve raw rows against the in-memory catalog and source-bin on-hand map.
 * Dedupes by resolved item id (sums quantity, records merged line numbers).
 */
export function resolvePastedRows(
  raw: RawPasteRow[],
  catalog: PasteCatalogItem[],
  onHandByItemId: Map<string, number>,
): ResolvedPasteRow[] {
  const byCode = new Map<string, PasteCatalogItem>();
  const byBarcode = new Map<string, PasteCatalogItem>();
  const bySku = new Map<string, PasteCatalogItem>();
  for (const c of catalog) {
    if (c.item_code) byCode.set(c.item_code.trim().toLowerCase(), c);
    if (c.barcode) byBarcode.set(c.barcode.trim().toLowerCase(), c);
    if (c.sku) bySku.set(c.sku.trim().toLowerCase(), c);
  }

  const resolved: ResolvedPasteRow[] = [];
  const indexByItemId = new Map<string, number>();

  for (const row of raw) {
    const messages: string[] = [];
    const key = row.code.trim().toLowerCase();
    const match =
      byCode.get(key) ?? byBarcode.get(key) ?? bySku.get(key) ?? undefined;
    const qtyNum = Number(row.qty);
    const qtyValid = Number.isFinite(qtyNum) && qtyNum > 0;

    if (!match) {
      resolved.push({
        lineNumber: row.lineNumber,
        rawLine: row.rawLine,
        code: row.code,
        quantity: qtyValid ? qtyNum : 0,
        unit_of_measure: row.uom ?? "",
        status: "error",
        messages: [row.code ? "Item not found" : "Missing item code"],
      });
      continue;
    }
    if (!qtyValid) {
      resolved.push({
        lineNumber: row.lineNumber,
        rawLine: row.rawLine,
        code: row.code,
        matchedItem: match,
        quantity: 0,
        unit_of_measure: row.uom ?? match.unit_of_measure ?? "",
        status: "error",
        messages: ["Quantity must be a number greater than 0"],
      });
      continue;
    }

    const baseUom = match.unit_of_measure ?? "";
    const uom = row.uom?.trim() || baseUom;
    if (row.uom && baseUom && row.uom.trim().toLowerCase() !== baseUom.toLowerCase()) {
      messages.push(`UoM "${row.uom}" differs from base "${baseUom}"`);
    }

    const existingIdx = indexByItemId.get(match.id);
    if (existingIdx !== undefined) {
      const existing = resolved[existingIdx];
      existing.quantity += qtyNum;
      existing.mergedFromLines = [
        ...(existing.mergedFromLines ?? [existing.lineNumber]),
        row.lineNumber,
      ];
      const merged = existing.mergedFromLines.length;
      existing.messages = existing.messages.filter(
        (m) => !m.startsWith("Merged "),
      );
      existing.messages.push(`Merged ${merged} duplicate lines`);
      // re-evaluate stock status after sum
      const onHand = onHandByItemId.get(match.id) ?? 0;
      existing.onHand = onHand;
      const hasOverStock = existing.quantity > onHand;
      existing.messages = existing.messages.filter(
        (m) => !m.startsWith("Exceeds on-hand"),
      );
      if (hasOverStock) {
        existing.messages.push(`Exceeds on-hand (${onHand})`);
      }
      existing.status =
        existing.messages.length > 0 && (hasOverStock || existing.messages.some((m) => m.startsWith("UoM")))
          ? "warning"
          : merged > 1
            ? "warning"
            : existing.status;
      continue;
    }

    const onHand = onHandByItemId.get(match.id) ?? 0;
    if (qtyNum > onHand) {
      messages.push(`Exceeds on-hand (${onHand})`);
    }

    const status: ResolvedStatus = messages.length > 0 ? "warning" : "ok";
    indexByItemId.set(match.id, resolved.length);
    resolved.push({
      lineNumber: row.lineNumber,
      rawLine: row.rawLine,
      code: row.code,
      matchedItem: match,
      quantity: qtyNum,
      unit_of_measure: uom,
      onHand,
      status,
      messages,
    });
  }

  return resolved;
}

export function buildTemplateCsv(): string {
  return "item_code,quantity,uom\nEXAMPLE-001,10,pcs\nEXAMPLE-002,5,pcs\n";
}
