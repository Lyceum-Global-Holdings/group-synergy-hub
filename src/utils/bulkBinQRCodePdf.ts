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
 * Generate a multi-page PDF of bin-allocation QR labels.
 *
 * Label geometry (international logistics label conventions):
 *   - Page (outer) size: 102 x 51 mm landscape
 *   - Printable content area: 96 x 48 mm (3 mm margin all round, 1.5 mm top/bottom)
 *   - Border line drawn at the inner rectangle
 *
 * Standards:
 *   - ISO/IEC 18004 — QR Code symbology, ECC level M (~15% recovery)
 *   - ISO/IEC 15415 — print quality; quiet zone >= 4 modules
 *   - GS1 Digital Link — payload format (see buildBinQRPayload)
 */
const PAGE_W = 102;
const PAGE_H = 51;
const MARGIN_X = 3;     // 3 mm left/right -> 96 mm content width
const MARGIN_Y = 1.5;   // 1.5 mm top/bottom -> 48 mm content height
const INNER_W = PAGE_W - MARGIN_X * 2; // 96
const INNER_H = PAGE_H - MARGIN_Y * 2; // 48
const QR_SIZE = 45;     // 45 x 45 mm QR module

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

    // ISO/IEC 15415 quiet zone (margin: 4 modules), ECC M per ISO/IEC 18004
    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: 600,
      margin: 4,
      errorCorrectionLevel: 'M',
    });

    // White background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

    // Border at inner rectangle (96 x 48 mm)
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_X, MARGIN_Y, INNER_W, INNER_H);

    // QR on the left, vertically centred within the inner rectangle
    const qrX = MARGIN_X + 1.5;
    const qrY = MARGIN_Y + (INNER_H - QR_SIZE) / 2;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, QR_SIZE, QR_SIZE);

    // Text column to the right of the QR
    const textX = qrX + QR_SIZE + 3; // ~52.5 mm
    doc.setTextColor(0, 0, 0);

    // Item code — bold mono for scanability
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text(truncate(a.item_code ?? '—', 18), textX, MARGIN_Y + 8);

    // Item name
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(truncate(a.item_name ?? '', 28), textX, MARGIN_Y + 16);

    // Bin
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Bin:', textX, MARGIN_Y + 26);
    doc.setFont('helvetica', 'normal');
    doc.text(truncate(a.bin_code ?? '—', 22), textX + 9, MARGIN_Y + 26);

    // Location (full path / code)
    const locLine = a.location_code
      ? a.location_name
        ? `${a.location_name} (${a.location_code})`
        : a.location_code
      : a.location_name ?? '—';
    doc.setFont('helvetica', 'bold');
    doc.text('Loc:', textX, MARGIN_Y + 33);
    doc.setFont('helvetica', 'normal');
    doc.text(truncate(locLine, 28), textX + 9, MARGIN_Y + 33);

    // Allocated quantity (footer)
    if (a.allocated_quantity != null) {
      doc.setFont('helvetica', 'bold');
      doc.text('Qty:', textX, MARGIN_Y + 40);
      doc.setFont('helvetica', 'normal');
      doc.text(String(a.allocated_quantity), textX + 9, MARGIN_Y + 40);
    }
  }

  return doc.output('blob');
}

export function downloadBulkBinQRCodePdf(blob: Blob, filename?: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `bin-qr-codes-${new Date().toISOString().split('T')[0]}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
