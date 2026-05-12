import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { buildBinQRPayload } from './binQRPayload';

export interface BinAllocationForQR {
  id: string;
  item_code?: string | null;
  item_name?: string | null;
  bin_code?: string | null;
  location_name?: string | null;
  location_code?: string | null;
  allocated_quantity?: number | null;
}

/**
 * Multi-page PDF of bin-allocation QR labels.
 *
 * Geometry (international logistics label conventions):
 *   - Page (outer): 102 x 51 mm landscape
 *   - Printable inner content: 96 x 48 mm (3 mm side, 1.5 mm top/bottom margins)
 *   - 0.3 mm border at the inner rectangle
 *
 * Standards:
 *   - ISO/IEC 18004 (QR symbology, ECC M ~15%)
 *   - ISO/IEC 15415 / 15416 (print quality, quiet zone, HRI legibility)
 *   - GS1 General Specifications §4.14 (HRI: monospace for code, mixed for text)
 *   - GS1 Digital Link (payload, see buildBinQRPayload)
 */
const PAGE_W = 102;
const PAGE_H = 51;
const MARGIN_X = 3;
const MARGIN_Y = 1.5;
const INNER_W = PAGE_W - MARGIN_X * 2; // 96
const INNER_H = PAGE_H - MARGIN_Y * 2; // 48
const QR_SIZE = 45;

const TEXT_PAD = 1.5;            // padding inside inner rectangle for text
const KEY_GAP = 0.5;             // gap (mm) below a key/value first line
const BLOCK_GAP = 1.2;           // gap between blocks
const MIN_FONT = 6.5;            // ISO 15416 minimum legible HRI
const FLOOR = { item: 7.5, name: 6.5, bin: 7.0 };

type Block = {
  key: string;
  value: string;
  font: 'courier' | 'helvetica';
  style: 'bold' | 'normal';
  startSize: number;
};

export async function generateBulkBinQRCodePdf(allocations: BinAllocationForQR[]): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PAGE_W, PAGE_H] });

  for (let i = 0; i < allocations.length; i++) {
    const a = allocations[i];
    const payload = buildBinQRPayload({
      allocationId: a.id,
      itemCode: a.item_code,
      binCode: a.bin_code,
      locationCode: a.location_code,
    });

    if (i > 0) doc.addPage([PAGE_W, PAGE_H], 'landscape');

    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: 600,
      margin: 4,
      errorCorrectionLevel: 'M',
    });

    // Background + border
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_X, MARGIN_Y, INNER_W, INNER_H);

    // QR (left, vertically centred)
    const qrX = MARGIN_X + 1.5;
    const qrY = MARGIN_Y + (INNER_H - QR_SIZE) / 2;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, QR_SIZE, QR_SIZE);

    // Text column
    const textX = qrX + QR_SIZE + 3;            // ~52.5 mm
    const textRight = MARGIN_X + INNER_W - 1.5; // right edge for wrap
    const textTop = MARGIN_Y + TEXT_PAD;
    const textBottom = MARGIN_Y + INNER_H - TEXT_PAD;

    const blocks: Block[] = [
      { key: 'Item:', value: a.item_code ?? '—', font: 'courier',   style: 'bold',   startSize: 10   },
      { key: 'Name:', value: a.item_name ?? '—', font: 'helvetica', style: 'normal', startSize: 8.5  },
      { key: 'Bin:',  value: a.bin_code  ?? '—', font: 'helvetica', style: 'bold',   startSize: 9    },
    ];

    renderTextBlocks(doc, blocks, {
      textX,
      textRight,
      top: textTop,
      bottom: textBottom,
    });
  }

  return doc.output('blob');
}

function renderTextBlocks(
  doc: jsPDF,
  blocks: Block[],
  bounds: { textX: number; textRight: number; top: number; bottom: number },
) {
  const { textX, textRight, top, bottom } = bounds;
  const available = bottom - top;
  const floors = [FLOOR.item, FLOOR.name, FLOOR.bin];

  // Try start sizes, shrink uniformly until total fits or floors hit.
  let sizes = blocks.map((b) => b.startSize);
  let layout = computeLayout(doc, blocks, sizes, textX, textRight);

  while (layout.totalH > available) {
    const canShrink = sizes.some((s, i) => s - 0.5 >= floors[i]);
    if (!canShrink) break;
    sizes = sizes.map((s, i) => (s - 0.5 >= floors[i] ? s - 0.5 : s));
    layout = computeLayout(doc, blocks, sizes, textX, textRight);
  }

  // Render. If still overflowing, allow last block to ellipsise its tail line.
  let y = top;
  doc.setTextColor(0, 0, 0);

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    const size = sizes[bi];
    const lh = size * 0.353 + 0.6; // pt -> mm-ish line height
    doc.setFont(b.font, b.style);
    doc.setFontSize(size);

    // Key on first line
    const keyW = doc.getTextWidth(b.key + ' ');
    const valX = textX + keyW;
    const valMaxW = textRight - valX;
    const lines: string[] = doc.splitTextToSize(b.value, valMaxW);

    // Capacity check for this block
    const remaining = bottom - y;
    let maxLines = Math.max(1, Math.floor(remaining / lh));
    let toRender = lines;
    if (lines.length > maxLines) {
      toRender = lines.slice(0, maxLines);
      // Ellipsise last visible line
      const last = toRender[toRender.length - 1];
      toRender[toRender.length - 1] = ellipsiseToWidth(doc, last, valMaxW);
    }

    // First line: key + first value line
    doc.text(b.key, textX, y + lh - 0.6);
    doc.text(toRender[0] ?? '', valX, y + lh - 0.6);
    y += lh + KEY_GAP;

    // Continuation lines aligned under value column
    for (let li = 1; li < toRender.length; li++) {
      doc.text(toRender[li], valX, y + lh - 0.6);
      y += lh;
    }

    y += BLOCK_GAP;
    if (y >= bottom) break;
  }
}

function computeLayout(
  doc: jsPDF,
  blocks: Block[],
  sizes: number[],
  textX: number,
  textRight: number,
) {
  let totalH = 0;
  const lineCounts: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const size = sizes[i];
    const lh = size * 0.353 + 0.6;
    doc.setFont(b.font, b.style);
    doc.setFontSize(size);
    const keyW = doc.getTextWidth(b.key + ' ');
    const valMaxW = textRight - (textX + keyW);
    const lines: string[] = doc.splitTextToSize(b.value, valMaxW);
    lineCounts.push(lines.length);
    totalH += lh * lines.length + KEY_GAP + BLOCK_GAP;
  }
  return { totalH, lineCounts };
}

function ellipsiseToWidth(doc: jsPDF, s: string, maxW: number): string {
  if (doc.getTextWidth(s) <= maxW) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (doc.getTextWidth(s.slice(0, mid) + '…') <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo) + '…';
}

export function downloadBulkBinQRCodePdf(blob: Blob, filename?: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `bin-qr-codes-${new Date().toISOString().split('T')[0]}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
