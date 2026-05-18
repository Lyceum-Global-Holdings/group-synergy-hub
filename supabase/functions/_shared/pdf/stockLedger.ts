// Stock Movement Ledger PDF — compact unified table, ISO 8601 period.
// Deno-compatible — uses pdf-lib (no native deps).
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "https://esm.sh/pdf-lib@1.17.1";

export interface LedgerRow {
  date: string;          // ISO
  docNo: string;
  refType: string;
  description: string;
  inQty: number;
  outQty: number;
  uom: string;
  unitCost: number;
  value: number;
}

export interface LedgerItemSection {
  itemCode: string;
  itemName: string;
  uom: string;
  rows: LedgerRow[];
  totalIn: number;
  totalOut: number;
}

export interface LedgerLocationSection {
  locationName: string;
  items: LedgerItemSection[];
}

export interface LedgerInput {
  companyName: string;
  periodFrom: string;     // YYYY-MM-DD
  periodTo: string;       // YYYY-MM-DD (inclusive)
  generatedAt: string;    // ISO 8601
  currency: string;
  sections: LedgerLocationSection[];
  totals: { in: number; out: number; netValue: number };
}

const A4_LANDSCAPE = { w: 841.89, h: 595.28 };
const MARGIN = 28;
const ROW_H = 12;
const HEADER_H = 54;
const FOOTER_H = 20;

// Budget: 841.89 - 56 = 785.89pt
const COLS = [
  { key: "date",    label: "Date",      w: 58,  align: "left"  as const },
  { key: "item",    label: "Item",      w: 200, align: "left"  as const },
  { key: "docNo",   label: "Doc #",     w: 70,  align: "left"  as const },
  { key: "refType", label: "Type",      w: 55,  align: "left"  as const },
  { key: "desc",    label: "Desc",      w: 90,  align: "left"  as const },
  { key: "in",      label: "In",        w: 50,  align: "right" as const },
  { key: "out",     label: "Out",       w: 50,  align: "right" as const },
  { key: "uom",     label: "UOM",       w: 38,  align: "left"  as const },
  { key: "cost",    label: "Unit Cost", w: 70,  align: "right" as const },
  { key: "value",   label: "Value",     w: 80,  align: "right" as const },
];
const TABLE_W = COLS.reduce((s, c) => s + c.w, 0);

const fmtN = (n: number, d = 2) =>
  (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// ISO 8601 interval (RFC 3339 dates, "/" separator)
const isoPeriod = (from: string, to: string) => `${from}/${to}`;
// ISO 8601 instant trimmed to seconds, Zulu
const isoInstant = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toISOString().replace(/\.\d{3}Z$/, "Z");
};

function sanitize(s: string): string {
  return String(s ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function truncate(s: string, font: PDFFont, size: number, maxW: number): string {
  s = sanitize(s);
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (font.widthOfTextAtSize(s.slice(0, mid) + "...", size) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo) + "...";
}

export async function buildStockLedgerPdf(input: LedgerInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pages: PDFPage[] = [];
  let page = pdf.addPage([A4_LANDSCAPE.w, A4_LANDSCAPE.h]);
  pages.push(page);
  let y = A4_LANDSCAPE.h - MARGIN;

  const periodIso = isoPeriod(input.periodFrom, input.periodTo);
  const generatedIso = isoInstant(input.generatedAt);

  const drawHeader = () => {
    page.drawText(sanitize(input.companyName), { x: MARGIN, y: y - 11, size: 12, font: bold, color: rgb(0.1, 0.1, 0.2) });
    page.drawText("Stock Movement Ledger", { x: MARGIN, y: y - 25, size: 9, font: bold });
    const meta = `Period ${periodIso}  ·  ${input.currency}  ·  Generated ${generatedIso}`;
    page.drawText(sanitize(meta), { x: MARGIN, y: y - 38, size: 7.5, font, color: rgb(0.35, 0.35, 0.35) });
    page.drawLine({
      start: { x: MARGIN, y: y - 44 }, end: { x: A4_LANDSCAPE.w - MARGIN, y: y - 44 },
      thickness: 0.4, color: rgb(0.7, 0.7, 0.7),
    });
    y -= HEADER_H;
  };

  const drawTableHeader = () => {
    let x = MARGIN;
    page.drawRectangle({ x, y: y - ROW_H + 2, width: TABLE_W, height: ROW_H, color: rgb(0.92, 0.94, 0.98) });
    for (const c of COLS) {
      const tx = c.align === "right" ? x + c.w - 4 - bold.widthOfTextAtSize(c.label, 7.5) : x + 4;
      page.drawText(c.label, { x: tx, y: y - ROW_H + 4, size: 7.5, font: bold });
      x += c.w;
    }
    y -= ROW_H;
  };

  const newPage = () => {
    page = pdf.addPage([A4_LANDSCAPE.w, A4_LANDSCAPE.h]);
    pages.push(page);
    y = A4_LANDSCAPE.h - MARGIN;
    drawHeader();
    drawTableHeader();
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + FOOTER_H) newPage();
  };

  const drawRow = (cells: string[], opts: { bold?: boolean; bg?: [number, number, number] } = {}) => {
    ensureSpace(ROW_H);
    let x = MARGIN;
    if (opts.bg) {
      page.drawRectangle({ x, y: y - ROW_H + 2, width: TABLE_W, height: ROW_H, color: rgb(...opts.bg) });
    }
    const f = opts.bold ? bold : font;
    for (let i = 0; i < COLS.length; i++) {
      const c = COLS[i];
      const txt = truncate(cells[i] ?? "", f, 7.5, c.w - 8);
      const tx = c.align === "right" ? x + c.w - 4 - f.widthOfTextAtSize(txt, 7.5) : x + 4;
      page.drawText(txt, { x: tx, y: y - ROW_H + 4, size: 7.5, font: f });
      x += c.w;
    }
    page.drawLine({
      start: { x: MARGIN, y: y - ROW_H + 1 }, end: { x: MARGIN + TABLE_W, y: y - ROW_H + 1 },
      thickness: 0.15, color: rgb(0.88, 0.88, 0.88),
    });
    y -= ROW_H;
  };

  // === Render ===
  drawHeader();

  if (input.sections.length === 0) {
    page.drawText("No stock movements recorded for this period.", {
      x: MARGIN, y: y - 16, size: 9, font, color: rgb(0.4, 0.4, 0.4),
    });
  } else {
    drawTableHeader();
    const multiLoc = input.sections.length > 1;
    for (const loc of input.sections) {
      if (multiLoc) {
        ensureSpace(ROW_H);
        page.drawRectangle({ x: MARGIN, y: y - ROW_H + 2, width: TABLE_W, height: ROW_H, color: rgb(0.96, 0.96, 0.96) });
        page.drawText(sanitize(loc.locationName), { x: MARGIN + 4, y: y - ROW_H + 4, size: 7.5, font: bold, color: rgb(0.1, 0.2, 0.4) });
        y -= ROW_H;
      }
      for (const item of loc.items) {
        const itemLabel = `${item.itemCode} · ${item.itemName}`;
        for (const r of item.rows) {
          drawRow([
            r.date.slice(0, 10),
            itemLabel,
            r.docNo,
            r.refType,
            r.description,
            r.inQty ? fmtN(r.inQty) : "",
            r.outQty ? fmtN(r.outQty) : "",
            r.uom,
            fmtN(r.unitCost),
            fmtN(r.value),
          ]);
        }
      }
    }
  }

  // Grand totals
  ensureSpace(24);
  y -= 4;
  page.drawLine({
    start: { x: MARGIN, y: y }, end: { x: A4_LANDSCAPE.w - MARGIN, y: y },
    thickness: 0.4, color: rgb(0.5, 0.5, 0.5),
  });
  y -= 12;
  page.drawText(
    `Totals — In: ${fmtN(input.totals.in)}  ·  Out: ${fmtN(input.totals.out)}  ·  Net Value: ${input.currency} ${fmtN(input.totals.netValue)}`,
    { x: MARGIN, y: y - 4, size: 8, font: bold },
  );

  // Footers
  const total = pages.length;
  for (let i = 0; i < pages.length; i++) {
    page = pages[i];
    const txt = `Page ${i + 1}/${total}  ·  Lyceum Global Holdings  ·  ${generatedIso}`;
    page.drawText(sanitize(txt), { x: MARGIN, y: MARGIN - 14, size: 6.5, font, color: rgb(0.45, 0.45, 0.45) });
  }

  return await pdf.save();
}
