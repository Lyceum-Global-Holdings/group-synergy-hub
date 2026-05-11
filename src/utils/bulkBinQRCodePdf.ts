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
 * Generate a multi-page PDF of 2"x1" landscape labels — one per (item × bin × location) allocation.
 * QR encodes a GS1 Digital Link URL pointing at the public resolver page.
 * ECC level M (15%) per ISO/IEC 18004 to balance density and damage tolerance.
 */
export async function generateBulkBinQRCodePdf(allocations: BinAllocationForQR[]): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: [2, 1] });

  for (let i = 0; i < allocations.length; i++) {
    const a = allocations[i];
    const payload = buildBinQRPayload({
      allocationId: a.id,
      itemCode: a.item_code,
      binCode: a.bin_code,
      locationCode: a.location_code,
    });

    if (i > 0) doc.addPage([2, 1], 'landscape');

    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 2, 1, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.01);
    doc.rect(0.02, 0.02, 1.96, 0.96);

    doc.addImage(qrDataUrl, 'PNG', 0.05, 0.05, 0.9, 0.9);

    const textX = 1.02;
    doc.setTextColor(0, 0, 0);

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.text(truncate(a.item_code ?? '—', 14), textX, 0.22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Item: ${truncate(a.item_name ?? '', 18)}`, textX, 0.4);
    doc.text(`Bin:  ${truncate(a.bin_code ?? '—', 18)}`, textX, 0.55);
    doc.text(`Loc:  ${truncate(a.location_name ?? '—', 18)}`, textX, 0.7);
    if (typeof a.allocated_quantity === 'number') {
      doc.text(`Qty:  ${a.allocated_quantity}`, textX, 0.85);
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
