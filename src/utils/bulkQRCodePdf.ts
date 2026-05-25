import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { buildAssetQRPayload } from './assetQRPayload';

export interface AssetForQR {
  id: string;
  name: string;
  asset_id?: string | null;
  serial_number?: string | null;
  asset_tag?: string | null;
}

export async function generateBulkQRCodePdf(assets: AssetForQR[]): Promise<Blob> {
  // 2x1 inch landscape labels (same as AssetQRCode component)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: [2, 1]
  });

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const publicUrl = buildAssetQRPayload({
      assetId: asset.id,
      assetTag: asset.asset_tag,
      serialNumber: asset.serial_number,
    });
    const label = asset.asset_id || asset.serial_number || asset.asset_tag || asset.id.slice(0, 8);

    if (i > 0) {
      doc.addPage([2, 1], 'landscape');
    }

    // Generate QR code
    const qrDataUrl = await QRCode.toDataURL(publicUrl, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M'
    });

    // White background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 2, 1, 'F');
    
    // Border
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.01);
    doc.rect(0.02, 0.02, 1.96, 0.96);

    // QR code on left (~0.9x0.9 inch)
    doc.addImage(qrDataUrl, 'PNG', 0.05, 0.05, 0.9, 0.9);

    // Label text on right - split category path from number
    doc.setFontSize(9);
    doc.setFont('courier', 'bold');
    doc.setTextColor(0, 0, 0);

    // Split the label - keep all but last part together, last part on new line
    const labelParts = label.split('/');
    if (labelParts.length > 1) {
      // Category path (e.g., FUR/CHA/CH)
      const categoryPath = labelParts.slice(0, -1).join('/');
      // Number (e.g., 001)
      const number = labelParts[labelParts.length - 1];
      
      doc.text(categoryPath, 1.05, 0.4);
      doc.text(number, 1.05, 0.55);
    } else {
      // Single part - display as is
      doc.text(label, 1.05, 0.45);
    }

    // Add asset name below
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    const maxNameLength = 16;
    const displayName = asset.name.length > maxNameLength 
      ? asset.name.slice(0, maxNameLength) + '...' 
      : asset.name;
    doc.text(displayName, 1.05, 0.7);
  }

  return doc.output('blob');
}

export function downloadBulkQRCodePdf(blob: Blob, filename?: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `asset-qr-codes-${new Date().toISOString().split('T')[0]}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
