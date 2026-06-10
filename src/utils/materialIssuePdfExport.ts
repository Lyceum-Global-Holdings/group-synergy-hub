import type { Company } from '@/types/company';
import type { MaterialIssueNote, MaterialIssueItem } from '@/types/materialIssueReturn';

interface GenerateOptions {
  issue: MaterialIssueNote & { warehouse_locations?: { name?: string } | null };
  items: MaterialIssueItem[];
  company: Company | null;
  generatedByName?: string | null;
  approverNames?: {
    hod?: string | null;
    management?: string | null;
    issued?: string | null;
    received?: string | null;
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

export async function downloadMaterialIssuePdf(opts: GenerateOptions): Promise<void> {
  const { issue, items, company, generatedByName, approverNames } = opts;

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
      // ignore — fall back to no logo
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

  // Right block: title + MIN no + date + QR
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text('MATERIAL ISSUE NOTE', pageWidth - margin, cursorY + 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(`MIN No: ${issue.min_number ?? '—'}`, pageWidth - margin, cursorY + 32, { align: 'right' });
  doc.text(`Issue Date: ${ISO_DATE(issue.issue_date)}`, pageWidth - margin, cursorY + 44, { align: 'right' });
  doc.text(`Status: ${(issue.status ?? '').toUpperCase()}`, pageWidth - margin, cursorY + 56, { align: 'right' });

  // QR code (encodes MIN identifier for traceability)
  try {
    const qrDataUrl = await QRCode.toDataURL(`MIN:${issue.id}`, { margin: 0, width: 128 });
    doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 56, cursorY + 64, 56, 56);
  } catch {
    // ignore QR failures
  }

  cursorY += 128;
  doc.setDrawColor(180);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 14;

  // ---------- Issue / Requester details ----------
  const locationName =
    (issue as any).warehouse_locations?.name ??
    (issue as any).warehouse_location?.name ??
    '—';

  const fields: Array<[string, string]> = [
    ['Issued To', issue.issued_to || issue.requested_by || '—'],
    ['Department', issue.department || '—'],
    ['EPF Number', (issue as any).epf_number || '—'],
    ['Contact', (issue as any).contact_number || '—'],
    ['Location', locationName],
    ['Job Number', (issue as any).job_number || '—'],
    ['PR Number', (issue as any).pr_number || '—'],
    ['Required Date', ISO_DATE((issue as any).items_required_date)],
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
    doc.text(doc.splitTextToSize(f[1], colWidth - 80), x + 80, y);
  });
  cursorY += Math.ceil(fields.length / 2) * 14 + 8;

  // Purpose
  doc.setFont('helvetica', 'bold');
  doc.text('Purpose:', margin, cursorY);
  doc.setFont('helvetica', 'normal');
  const purposeLines = doc.splitTextToSize(issue.purpose || '—', pageWidth - margin * 2 - 60);
  doc.text(purposeLines, margin + 60, cursorY);
  cursorY += Math.max(purposeLines.length * 12, 14);

  // ---------- Line items ----------
  const head = [['#', 'Item Code', 'Description', 'UOM', 'Required', 'Issued', 'Received']];
  const body = items.map((it, i) => [
    String(it.line_number ?? i + 1),
    it.item_code ?? '—',
    it.description ?? '—',
    it.unit_of_measure ?? 'pcs',
    String((it as any).quantity_required ?? it.quantity_issued ?? 0),
    String(it.quantity_issued ?? 0),
    String((it as any).quantity_received ?? 0),
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
      0: { cellWidth: 24, halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 14;

  // Notes
  if (issue.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Notes:', margin, cursorY);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(issue.notes, pageWidth - margin * 2 - 50);
    doc.text(noteLines, margin + 50, cursorY);
    cursorY += Math.max(noteLines.length * 12, 14) + 8;
  }

  // ---------- Signature block (4 columns) ----------
  const pageHeight = doc.internal.pageSize.getHeight();
  const sigY = Math.max(cursorY + 20, pageHeight - 130);
  const sigBlocks: Array<{ title: string; name?: string | null; date?: string | null }> = [
    {
      title: 'Requested By',
      name: issue.requested_by ?? issue.issued_to ?? null,
      date: ISO_DATE(issue.created_at),
    },
    {
      title: 'HOD Approval',
      name: approverNames?.hod ?? null,
      date: issue.hod_approval_date ? ISO_DATETIME(issue.hod_approval_date) : null,
    },
    {
      title: 'Management Approval',
      name: approverNames?.management ?? null,
      date: issue.management_approval_date ? ISO_DATETIME(issue.management_approval_date) : null,
    },
    {
      title: 'Received By',
      name: approverNames?.received ?? null,
      date: (issue as any).received_at ? ISO_DATETIME((issue as any).received_at) : null,
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

  // ---------- Document control footer (every page) ----------
  const totalPages = doc.getNumberOfPages();
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.setDrawColor(220);
    doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);
    doc.text(
      `MIN ${issue.min_number ?? ''}  ·  Generated ${generatedAt} UTC` +
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

  doc.save(`MIN-${issue.min_number ?? issue.id}.pdf`);
}
