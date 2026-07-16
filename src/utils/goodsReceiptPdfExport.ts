import type { Company } from '@/types/company';
import type { GoodsReceiptNote } from '@/types/grn';
import { GRN_REJECTION_REASON_LABELS, GRN_REJECTION_REASONS } from '@/types/grn';

interface GenerateOptions {
  grn: GoodsReceiptNote & {
    rejection_reason?: string | null;
    rejection_notes?: string | null;
    rejected_date?: string | null;
    rejected_by_profile?: { full_name?: string | null } | null;
    warehouse_locations?: { name?: string } | null;
  };
  company: Company | null;
  generatedByName?: string | null;
  currency?: string;
}

const ISO_DATE = (d?: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return '—';
  }
};

const ISO_DATETIME = (d?: string | null) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return `${dt.toISOString().slice(0, 10)} ${dt.toISOString().slice(11, 16)}`;
  } catch {
    return '—';
  }
};

const fmtMoney = (n: number, currency: string) =>
  `${currency} ${(Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadGrnPdf(opts: GenerateOptions): Promise<void> {
  const { grn, company, generatedByName } = opts;
  const currency = opts.currency || 'LKR';

  const [{ default: jsPDF }, autoTableMod, QRCodeMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('qrcode'),
  ]);
  const autoTable = (autoTableMod as { default: any }).default ?? (autoTableMod as any);
  const QRCode = (QRCodeMod as any).default ?? QRCodeMod;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  let cursorY = margin;

  // ---------- Header: Logo + Company + Document Title ----------
  const logoDataUrl = company?.logo_url ? await urlToDataUrl(company.logo_url) : null;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, cursorY, 56, 56);
    } catch {
      // ignore
    }
  }

  const companyTextX = margin + (logoDataUrl ? 70 : 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text(company?.name ?? 'Company', companyTextX, cursorY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80);
  const subLines: string[] = [];
  if (company?.address) subLines.push(company.address);
  if (company?.code) subLines.push(`Company Code: ${company.code}`);
  subLines.forEach((line, i) => {
    doc.text(line, companyTextX, cursorY + 32 + i * 12);
  });

  // Right block: title + GRN no + date + status + QR
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text('GOODS RECEIPT NOTE', pageWidth - margin, cursorY + 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(`GRN No: ${grn.grn_number ?? '—'}`, pageWidth - margin, cursorY + 32, { align: 'right' });
  doc.text(`GRN Date: ${ISO_DATE(grn.grn_date)}`, pageWidth - margin, cursorY + 44, { align: 'right' });
  doc.text(`Status: ${(grn.status ?? '').toUpperCase()}`, pageWidth - margin, cursorY + 56, { align: 'right' });

  try {
    const qrDataUrl = await QRCode.toDataURL(`GRN:${grn.id}`, { margin: 0, width: 128 });
    doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 56, cursorY + 64, 56, 56);
  } catch {
    // ignore
  }

  cursorY += 128;
  doc.setDrawColor(180);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 14;

  // ---------- Supplier / Invoice / PO meta ----------
  const supplierName = grn.supplier_name || grn.purchase_order?.supplier?.name || '—';
  const poNumber = grn.po_number || grn.purchase_order?.po_number || '—';
  const locationName =
    (grn as any).warehouse_locations?.name ?? (grn as any).warehouse_location?.name ?? '—';

  const fields: Array<[string, string]> = [
    ['Supplier', supplierName],
    ['PO Number', poNumber],
    ['Supplier Address', grn.supplier_address || '—'],
    ['Receiving Location', locationName],
    ['Invoice Number', grn.invoice_number || '—'],
    ['Invoice Date', grn.invoice_date ? ISO_DATE(grn.invoice_date) : '—'],
    ['Currency', currency],
    ['Total Value', fmtMoney(grn.total_value, currency)],
  ];

  doc.setFontSize(9);
  doc.setTextColor(30);
  const colWidth = (pageWidth - margin * 2) / 2;
  fields.forEach((f, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = margin + col * colWidth;
    const y = cursorY + row * 14;
    doc.setFont('helvetica', 'bold');
    doc.text(`${f[0]}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(f[1], colWidth - 90), x + 90, y);
  });
  cursorY += Math.ceil(fields.length / 2) * 14 + 8;

  // Remarks
  if (grn.remarks) {
    doc.setFont('helvetica', 'bold');
    doc.text('Remarks:', margin, cursorY);
    doc.setFont('helvetica', 'normal');
    const remarkLines = doc.splitTextToSize(grn.remarks, pageWidth - margin * 2 - 60);
    doc.text(remarkLines, margin + 60, cursorY);
    cursorY += Math.max(remarkLines.length * 12, 14);
  }

  // ---------- Line items ----------
  const head = [['#', 'Item Code', 'Item Name', 'UOM', 'Qty Ord', 'Qty Recv', 'Unit Price', 'Total Cost', 'Quality']];
  const items = grn.grn_items ?? [];
  const body = items.map((it, i) => [
    String(i + 1),
    it.item_code || (it as any).catalog?.item_code || '—',
    it.item_name || (it as any).catalog?.name || '—',
    it.unit_of_measure ?? '',
    it.quantity_ordered != null ? String(it.quantity_ordered) : '—',
    String(it.quantity_received ?? 0),
    fmtMoney(it.unit_price, currency),
    fmtMoney(it.total_cost, currency),
    (it.quality_status ?? '').toString().toUpperCase(),
  ]);

  autoTable(doc, {
    startY: cursorY + 6,
    head,
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 247, 247] },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 12;

  // ---------- Totals ----------
  doc.setDrawColor(180);
  doc.line(pageWidth - margin - 220, cursorY, pageWidth - margin, cursorY);
  cursorY += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Total Items: ${items.length}`, pageWidth - margin, cursorY, { align: 'right' });
  cursorY += 14;
  const lineDisc = items.reduce((s: number, it: any) => s + (Number(it.line_discount_amount) || 0), 0);
  if (Number(grn.subtotal_value) > 0 && (lineDisc > 0 || Number(grn.discount_amount) > 0)) {
    doc.text(`Subtotal: ${fmtMoney(grn.subtotal_value, currency)}`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 14;
    if (lineDisc > 0) {
      doc.text(`Line Discounts: -${fmtMoney(lineDisc, currency)}`, pageWidth - margin, cursorY, { align: 'right' });
      cursorY += 14;
    }
    if (Number(grn.discount_amount) > 0) {
      doc.text(`Overall Discount: -${fmtMoney(grn.discount_amount, currency)}`, pageWidth - margin, cursorY, { align: 'right' });
      cursorY += 14;
    }
    doc.text(`Net (Goods): ${fmtMoney(grn.total_value, currency)}`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 14;
  }
  if (Number(grn.tax_amount) > 0) {
    doc.text(`Tax: +${fmtMoney(grn.tax_amount, currency)}`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 14;
  }
  if (Number(grn.transport_cost) > 0) {
    doc.text(`Transport / Freight: +${fmtMoney(grn.transport_cost, currency)}`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 14;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Grand Total: ${fmtMoney(grn.grand_total ?? grn.total_value, currency)}`, pageWidth - margin, cursorY, { align: 'right' });
  cursorY += 18;

  // ---------- Rejection panel (if rejected) ----------
  if (grn.status === 'rejected' && grn.rejection_reason) {
    const reasonMeta = GRN_REJECTION_REASONS.find((r) => r.value === grn.rejection_reason);
    const reasonLabel = GRN_REJECTION_REASON_LABELS[grn.rejection_reason as keyof typeof GRN_REJECTION_REASON_LABELS] ?? grn.rejection_reason;
    const panelHeight = 70;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(220, 38, 38);
    doc.rect(margin, cursorY, pageWidth - margin * 2, panelHeight, 'FD');
    doc.setTextColor(153, 27, 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('GRN REJECTED', margin + 8, cursorY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60);
    doc.text(`Reason: ${reasonLabel}${reasonMeta?.description ? ` (${reasonMeta.description})` : ''}`, margin + 8, cursorY + 28);
    if (grn.rejection_notes) {
      const noteLines = doc.splitTextToSize(`Notes: ${grn.rejection_notes}`, pageWidth - margin * 2 - 16);
      doc.text(noteLines, margin + 8, cursorY + 42);
    }
    const rejectedBy = grn.rejected_by_profile?.full_name ?? '—';
    doc.text(
      `Rejected by ${rejectedBy} on ${ISO_DATETIME(grn.rejected_date)}`,
      pageWidth - margin - 8,
      cursorY + panelHeight - 6,
      { align: 'right' },
    );
    cursorY += panelHeight + 12;
  }

  // ---------- Signature block (4 columns) ----------
  const pageHeight = doc.internal.pageSize.getHeight();
  const sigY = Math.max(cursorY + 20, pageHeight - 130);
  const sigBlocks: Array<{ title: string; name?: string | null; date?: string | null }> = [
    {
      title: 'Received By',
      name: grn.received_by_profile?.full_name ?? null,
      date: ISO_DATETIME(grn.created_at),
    },
    {
      title: 'Quality Checked By',
      name: null,
      date: null,
    },
    {
      title: 'Approved By',
      name: grn.approved_by_profile?.full_name ?? null,
      date: grn.approved_date ? ISO_DATETIME(grn.approved_date) : null,
    },
    {
      title: 'Supplier Representative',
      name: null,
      date: null,
    },
  ];

  const sigWidth = (pageWidth - margin * 2) / sigBlocks.length;
  sigBlocks.forEach((s, i) => {
    const x = margin + i * sigWidth;
    doc.setDrawColor(120);
    doc.line(x + 8, sigY + 30, x + sigWidth - 8, sigY + 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30);
    doc.text(s.title, x + sigWidth / 2, sigY + 44, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    if (s.name) doc.text(s.name, x + sigWidth / 2, sigY + 56, { align: 'center' });
    if (s.date) doc.text(s.date, x + sigWidth / 2, sigY + 68, { align: 'center' });
  });

  // ---------- Footer ----------
  const totalPages = doc.getNumberOfPages();
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.setDrawColor(220);
    doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);
    doc.text(
      `GRN ${grn.grn_number ?? ''}  ·  Generated ${generatedAt} UTC` +
        (generatedByName ? ` by ${generatedByName}` : ''),
      margin,
      pageHeight - 16,
    );
    doc.text(
      `Confidential — Internal Use  ·  Source: Lyceum ERP  ·  Page ${p} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 16,
      { align: 'right' },
    );
  }

  doc.save(`GRN-${grn.grn_number ?? grn.id}.pdf`);
}
