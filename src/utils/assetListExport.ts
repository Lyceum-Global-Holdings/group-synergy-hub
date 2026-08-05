// Location-wise asset list export (CSV + PDF).
//
// A fixed-asset register grouped by location: every asset row under its
// location with per-location subtotals (count + value) and a grand total —
// the flat-list complement to the chart-style location analytics export.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface AssetListExportRow {
  asset_tag: string | null;
  name: string;
  category: string | null;
  brand: string | null;
  serial_number: string | null;
  location: string;
  sublocation: string | null;
  condition: string | null;
  status: string | null;
  purchase_date: string | null;
  current_value: number | null;
}

export interface AssetListExportMeta {
  companyName?: string | null;
  scopeLabel?: string | null; // e.g. "LNNB · All Sub-Locations" or "All Locations"
  formatCurrency?: (v: number) => string;
}

const stamp = () => new Date().toISOString().slice(0, 10);

const sortRows = (rows: AssetListExportRow[]) =>
  [...rows].sort(
    (a, b) =>
      a.location.localeCompare(b.location) ||
      (a.sublocation ?? "").localeCompare(b.sublocation ?? "") ||
      a.name.localeCompare(b.name) ||
      (a.asset_tag ?? "").localeCompare(b.asset_tag ?? ""),
  );

// ── CSV ─────────────────────────────────────────────────────────────────────
const csvEscape = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadAssetListCsv(rows: AssetListExportRow[], meta: AssetListExportMeta = {}) {
  const header = [
    "Location", "Sub-Location", "Asset ID", "Name", "Category", "Brand",
    "Serial Number", "Condition", "Status", "Purchase Date", "Current Value",
  ];
  const lines = sortRows(rows).map((r) =>
    [
      r.location, r.sublocation ?? "", r.asset_tag ?? "", r.name, r.category ?? "",
      r.brand ?? "", r.serial_number ?? "", r.condition ?? "", r.status ?? "",
      r.purchase_date ?? "", r.current_value ?? "",
    ].map(csvEscape).join(","),
  );
  // BOM so Excel opens it as UTF-8.
  const csv = "﻿" + [header.join(","), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Asset_List_By_Location_${stamp()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF ─────────────────────────────────────────────────────────────────────
export function downloadAssetListPdf(rows: AssetListExportRow[], meta: AssetListExportMeta = {}) {
  const fmt = meta.formatCurrency ?? ((v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2 }));
  const sorted = sortRows(rows);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Asset List — by Location", margin, 42);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const metaLine = [
    meta.companyName,
    meta.scopeLabel,
    `${sorted.length} asset(s)`,
    `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
  ].filter(Boolean).join("  ·  ");
  doc.text(metaLine, margin, 58);

  // Group rows by location; each group gets a full-width header row with its
  // subtotal, so the register reads location by location.
  const groups = new Map<string, AssetListExportRow[]>();
  for (const r of sorted) {
    if (!groups.has(r.location)) groups.set(r.location, []);
    groups.get(r.location)!.push(r);
  }

  const body: any[] = [];
  let grandValue = 0;
  for (const [location, groupRows] of groups) {
    const subtotal = groupRows.reduce((s, r) => s + (r.current_value ?? 0), 0);
    grandValue += subtotal;
    body.push([
      {
        content: `${location}  —  ${groupRows.length} asset(s) · ${fmt(subtotal)}`,
        colSpan: 9,
        styles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" },
      },
    ]);
    for (const r of groupRows) {
      body.push([
        r.asset_tag ?? "—",
        r.name,
        r.sublocation ?? "—",
        r.category ?? "—",
        r.brand ?? "—",
        r.serial_number ?? "—",
        r.condition ?? "—",
        r.status ?? "—",
        r.current_value != null ? fmt(r.current_value) : "—",
      ]);
    }
  }
  body.push([
    {
      content: `Grand total  —  ${sorted.length} asset(s) · ${fmt(grandValue)}`,
      colSpan: 9,
      styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    },
  ]);

  autoTable(doc, {
    startY: 72,
    margin: { left: margin, right: margin },
    head: [[
      "Asset ID", "Name", "Sub-Location", "Category", "Brand",
      "Serial #", "Condition", "Status", "Value",
    ]],
    body,
    styles: { fontSize: 7.5, cellPadding: 3 },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 8: { halign: "right" } },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(
        `Asset List by Location  ·  Generated ${stamp()}  ·  Page ${doc.getNumberOfPages()}`,
        margin,
        pageHeight - 16,
      );
      doc.setTextColor(0);
    },
  });

  doc.save(`Asset_List_By_Location_${stamp()}.pdf`);
}
