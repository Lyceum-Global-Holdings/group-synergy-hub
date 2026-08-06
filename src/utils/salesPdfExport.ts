// Quotation + Sales invoice PDFs — house style: header/meta, lines table,
// totals, terms, and the Approved by / Confirmed by / Received signature block.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Quotation, QuotationItem, InvoiceItem } from "@/types/sales";

interface DocMeta {
  companyName?: string | null;
  formatCurrency?: (v: number) => string;
}

const stamp = () => new Date().toISOString().slice(0, 10);

function drawSignatureBlock(doc: jsPDF, margin: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const blockHeight = 86;
  let y = ((doc as any).lastAutoTable?.finalY ?? 100) + 44;
  if (y + blockHeight > pageHeight - 30) {
    doc.addPage();
    y = 60;
  }
  const signatories = ["Approved by", "Confirmed by", "Received"];
  const gap = 30;
  const colWidth = (pageWidth - margin * 2 - gap * (signatories.length - 1)) / signatories.length;
  signatories.forEach((label, i) => {
    const x = margin + i * (colWidth + gap);
    doc.setDrawColor(120);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(x, y, x + colWidth, y);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(label, x, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text("Name:", x, y + 30);
    doc.setLineDashPattern([1, 1.5], 0);
    doc.line(x + 30, y + 31, x + colWidth, y + 31);
    doc.text("Date:", x, y + 46);
    doc.line(x + 30, y + 47, x + colWidth, y + 47);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(0);
  });
}

function renderSalesDoc(opts: {
  title: string;
  number: string;
  date: string;
  extraMetaRight: string[];
  customerName?: string | null;
  lines: { name: string; description?: string | null; unit: string; qty: number; price: number; total: number }[];
  totals: { label: string; value: string; bold?: boolean }[];
  notes?: string | null;
  terms?: string | null;
  meta: DocMeta;
  fileName: string;
}) {
  const fmt = opts.meta.formatCurrency ?? ((v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2 }));
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, margin, 48);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (opts.meta.companyName) doc.text(opts.meta.companyName, margin, 64);
  if (opts.customerName) {
    doc.setFont("helvetica", "bold");
    doc.text("To:", margin, 86);
    doc.setFont("helvetica", "normal");
    doc.text(opts.customerName, margin + 22, 86);
  }
  doc.setFontSize(9);
  const rightLines = [`${opts.title} No: ${opts.number}`, `Date: ${opts.date}`, ...opts.extraMetaRight];
  rightLines.forEach((l, i) => doc.text(l, pageWidth - margin, 48 + i * 13, { align: "right" }));

  autoTable(doc, {
    startY: 104,
    margin: { left: margin, right: margin },
    head: [["#", "Item", "Description", "Unit", "Qty", "Unit Price", "Total"]],
    body: opts.lines.map((l, i) => [
      String(i + 1), l.name, l.description ?? "", l.unit,
      String(l.qty), fmt(l.price), fmt(l.total),
    ]),
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 5: { halign: "right" }, 6: { halign: "right" } },
  });

  // Totals box, right-aligned under the table.
  let y = ((doc as any).lastAutoTable?.finalY ?? 104) + 14;
  doc.setFontSize(9.5);
  for (const t of opts.totals) {
    doc.setFont("helvetica", t.bold ? "bold" : "normal");
    doc.text(t.label, pageWidth - margin - 180, y);
    doc.text(t.value, pageWidth - margin, y, { align: "right" });
    y += 15;
  }

  if (opts.notes) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("Notes", margin, y + 6);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(opts.notes, pageWidth - margin * 2), margin, y + 19);
    y += 40;
  }
  if (opts.terms) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("Terms & Conditions", margin, y + 6);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(opts.terms, pageWidth - margin * 2), margin, y + 19);
  }

  drawSignatureBlock(doc, margin);

  const pageHeight = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`${opts.number}  ·  Generated ${stamp()}  ·  Page ${p} of ${total}`, margin, pageHeight - 16);
    doc.setTextColor(0);
  }

  doc.save(opts.fileName);
}

export function downloadQuotationPdf(quote: Quotation, items: QuotationItem[], meta: DocMeta = {}) {
  const fmt = meta.formatCurrency ?? ((v: number) => v.toFixed(2));
  renderSalesDoc({
    title: "Quotation",
    number: quote.quote_number,
    date: quote.quote_date,
    extraMetaRight: quote.valid_until ? [`Valid until: ${quote.valid_until}`] : [],
    customerName: quote.customer?.customer_name,
    lines: items.map((i) => ({
      name: i.item_name, description: i.description, unit: i.unit,
      qty: Number(i.quantity), price: Number(i.unit_price), total: Number(i.line_total),
    })),
    totals: [
      { label: "Subtotal", value: fmt(Number(quote.subtotal)) },
      ...(Number(quote.discount_amount) > 0 ? [{ label: "Discount", value: `- ${fmt(Number(quote.discount_amount))}` }] : []),
      ...(Number(quote.tax_amount) > 0 ? [{ label: "Tax", value: fmt(Number(quote.tax_amount)) }] : []),
      { label: "Total", value: fmt(Number(quote.total_amount)), bold: true },
    ],
    notes: quote.notes,
    terms: quote.terms,
    meta,
    fileName: `${quote.quote_number}.pdf`,
  });
}

export function downloadSalesInvoicePdf(
  invoice: { invoice_number: string; invoice_date: string; due_date: string | null; gross_amount: number; tax_amount: number | null; net_amount: number; amount_received?: number | null; notes?: string | null; customer?: { customer_name: string } | null },
  items: InvoiceItem[],
  meta: DocMeta = {},
) {
  const fmt = meta.formatCurrency ?? ((v: number) => v.toFixed(2));
  const received = Number(invoice.amount_received ?? 0);
  renderSalesDoc({
    title: "Invoice",
    number: invoice.invoice_number,
    date: invoice.invoice_date,
    extraMetaRight: invoice.due_date ? [`Due: ${invoice.due_date}`] : [],
    customerName: invoice.customer?.customer_name,
    lines: items.map((i) => ({
      name: i.item_name, description: i.description, unit: i.unit,
      qty: Number(i.quantity), price: Number(i.unit_price), total: Number(i.line_total),
    })),
    totals: [
      { label: "Subtotal", value: fmt(Number(invoice.gross_amount)) },
      ...(Number(invoice.tax_amount ?? 0) > 0 ? [{ label: "Tax", value: fmt(Number(invoice.tax_amount)) }] : []),
      { label: "Total", value: fmt(Number(invoice.net_amount)), bold: true },
      ...(received > 0 ? [
        { label: "Received", value: `- ${fmt(received)}` },
        { label: "Balance due", value: fmt(Number(invoice.net_amount) - received), bold: true },
      ] : []),
    ],
    notes: invoice.notes ?? null,
    terms: null,
    meta,
    fileName: `${invoice.invoice_number}.pdf`,
  });
}
