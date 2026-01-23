import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export interface AssetForQR {
  id: string;
  name: string;
  asset_id?: string | null;
  serial_number?: string | null;
  asset_tag?: string | null;
}

const PUBLISHED_APP_URL = 'https://group-synergy-hub.lovable.app';

export async function generateBulkQRCodePdf(assets: AssetForQR[]): Promise<Blob> {
  // 2x1 inch landscape labels (same as AssetQRCode component)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: [2, 1]
  });

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const publicUrl = `${PUBLISHED_APP_URL}/asset/${asset.id}`;
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

    // Label text on right
    doc.setFontSize(10);
    doc.setFont('courier', 'bold');
    doc.setTextColor(0, 0, 0);
    
    // Truncate label if too long
    const maxLabelLength = 12;
    const displayLabel = label.length > maxLabelLength 
      ? label.slice(0, maxLabelLength) + '...' 
      : label;
    
    doc.text(displayLabel, 1.05, 0.5);
    
    // Add asset name in smaller text below
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    const maxNameLength = 16;
    const displayName = asset.name.length > maxNameLength 
      ? asset.name.slice(0, maxNameLength) + '...' 
      : asset.name;
    doc.text(displayName, 1.05, 0.65);
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
