import type { Company } from '@/types/company';
import type { MaterialReturnNote, MaterialReturnItem } from '@/types/materialIssueReturn';

type ReturnItemRow = MaterialReturnItem & {
  item_code?: string | null;
  item_name?: string | null;
  unit_of_measure?: string | null;
};

interface GenerateOptions {
  returnNote: MaterialReturnNote & { warehouse_locations?: { name?: string } | null };
  items: ReturnItemRow[];
  company: Company | null;
  referenceNumber?: string | null;
  generatedByName?: string | null;
  approverNames?: {
    returnedBy?: string | null;
    preparedBy?: string | null;
    approved?: string | null;
    warehouseReceiver?: string | null;
  };
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

const fmtMoney = (v: number | null | undefined, currency?: string | null) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return n.toFixed(2);
  }
};

export async function downloadMaterialReturnPdf(opts: GenerateOptions): Promise<void> {
  const { returnNote, items, company, referenceNumber, generatedByName, approverNames } = opts;

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

  // ---------- Header ----------
  const logoDataUrl = company?.logo_url ? await urlToDataUrl(company.logo_url) : null;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, cursorY, 56, 56);
    } catch {
      /* ignore */
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

  // Right block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text('MATERIAL RETURN NOTE', pageWidth - margin, cursorY + 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(`MRN No: ${returnNote.mrn_number ?? '—'}`, pageWidth - margin, cursorY + 32, { align: 'right' });
  doc.text(`Return Date: ${ISO_DATE(returnNote.return_date)}`, pageWidth - margin, cursorY + 44, { align: 'right' });
  doc.text(`Status: ${(returnNote.status ?? '').toUpperCase()}`, pageWidth - margin, cursorY + 56, { align: 'right' });

  try {
    const qrDataUrl = await QRCode.toDataURL(`MRN:${returnNote.id}`, { margin: 0, width: 128 });
    doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 56, cursorY + 64, 56, 56);
  } catch {
    /* ignore */
  }

  cursorY += 128;
  doc.setDrawColor(180);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 14;

  // ---------- Meta grid ----------
  const locationName =
    (returnNote as any).warehouse_locations?.name ??
    (returnNote as any).warehouse_location?.name ??
    '—';

  const refLabel = returnNote.reference_type
    ? `${String(returnNote.reference_type).replace(/_/g, ' ')}${referenceNumber ? ` · ${referenceNumber}` : ''}`
    : '—';

  const fields: Array<[string, string]> = [
    ['Returned By', returnNote.returned_by || '—'],
    ['Return Type', (returnNote.return_type || '—').toString().toUpperCase()],
    ['Reference', refLabel],
    ['Location', locationName],
    ['SRN Number', returnNote.srn_number || '—'],
    ['Approved By', approverNames?.approved || '—'],
    ['Approved Date', returnNote.approved_date ? ISO_DATETIME(returnNote.approved_date) : '—'],
    ['Created', ISO_DATE(returnNote.created_at)],
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

  // Reason
  doc.setFont('helvetica', 'bold');
  doc.text('Reason:', margin, cursorY);
  doc.setFont('helvetica', 'normal');
  const reasonLines = doc.splitTextToSize(returnNote.reason || '—', pageWidth - margin * 2 - 60);
  doc.text(reasonLines, margin + 60, cursorY);
  cursorY += Math.max(reasonLines.length * 12, 14);

  // ---------- Line items ----------
  const currency = (company as any)?.currency ?? null;
  const head = [['#', 'Item Code', 'Description', 'UOM', 'Qty Returned', 'Bin', 'Condition', 'Unit Cost', 'Total Value']];
  const body = items.map((it, i) => [
    String(i + 1),
    it.item_code ?? '—',
    it.item_name ?? '—',
    it.unit_of_measure ?? 'pcs',
    String(it.quantity_returned ?? 0),
    (it as any).bin_code ?? '—',
    (it.condition ?? '—').toString().toUpperCase(),
    fmtMoney(it.unit_cost, currency),
    fmtMoney(it.total_cost, currency),
  ]);

  const totalValue = items.reduce((sum, it) => sum + (Number(it.total_cost) || 0), 0);

  autoTable(doc, {
    startY: cursorY + 6,
    head,
    body,
    foot: [[
      { content: 'Grand Total', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: fmtMoney(totalValue, currency), styles: { halign: 'right', fontStyle: 'bold' } },
    ]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    alternateRowStyles: { fillColor: [247, 247, 247] },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 14;

  // Notes
  if (returnNote.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Notes:', margin, cursorY);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(returnNote.notes, pageWidth - margin * 2 - 50);
    doc.text(noteLines, margin + 50, cursorY);
    cursorY += Math.max(noteLines.length * 12, 14) + 8;
  }

  // ---------- Signature block ----------
  const pageHeight = doc.internal.pageSize.getHeight();
  const sigY = Math.max(cursorY + 20, pageHeight - 130);
  const sigBlocks: Array<{ title: string; name?: string | null; date?: string | null }> = [
    {
      title: 'Returned By',
      name: approverNames?.returnedBy ?? returnNote.returned_by ?? null,
      date: ISO_DATE(returnNote.return_date),
    },
    {
      title: 'Prepared By',
      name: approverNames?.preparedBy ?? null,
      date: ISO_DATE(returnNote.created_at),
    },
    {
      title: 'Approved By',
      name: approverNames?.approved ?? null,
      date: returnNote.approved_date ? ISO_DATETIME(returnNote.approved_date) : null,
    },
    {
      title: 'Warehouse Receiver',
      name: approverNames?.warehouseReceiver ?? null,
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
      `MRN ${returnNote.mrn_number ?? ''}  ·  Generated ${generatedAt} UTC` +
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

  doc.save(`MRN-${returnNote.mrn_number ?? returnNote.id}.pdf`);
}
