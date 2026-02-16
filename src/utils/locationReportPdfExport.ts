import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  assetCount: number;
  totalValue: number;
}

export interface SubcategoryBreakdown {
  subcategoryId: string;
  subcategoryName: string;
  parentCategoryName: string;
  assetCount: number;
  totalValue: number;
  goodCondition: number;
  fairCondition: number;
  poorCondition: number;
  needsRepair: number;
}

export interface AssetMasterBreakdown {
  assetMasterId: string;
  assetMasterName: string;
  brand: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  assetCount: number;
  totalValue: number;
  goodCondition: number;
  fairCondition: number;
  poorCondition: number;
  needsRepair: number;
}

export interface LocationReportData {
  id: string;
  name: string;
  parentId?: string | null;
  parentName?: string;
  assetCount: number;
  totalValue: number;
  activeCount: number;
  maintenanceCount: number;
  inactiveCount: number;
  disposedCount: number;
  goodCondition: number;
  fairCondition: number;
  poorCondition: number;
  needsRepairCondition: number;
  utilizationRate: number;
  categoryBreakdown: CategoryBreakdown[];
  subcategoryBreakdown: SubcategoryBreakdown[];
  assetMasterBreakdown: AssetMasterBreakdown[];
}

export interface ReportKPIs {
  totalAssets: number;
  totalValue: number;
  topLocation: string;
  avgValuePerLocation: number;
  overallUtilization: number;
  locationCount: number;
}

export interface ChartData {
  assetCountData: { name: string; value: number }[];
  valueDistribution: { name: string; value: number }[];
  statusDistribution: { name: string; active: number; maintenance: number; inactive: number }[];
}

type ReportType = "location" | "sublocation" | "department";

export async function exportLocationReportPdf(
  reportData: LocationReportData[],
  reportType: ReportType,
  kpis: ReportKPIs,
  chartData: ChartData,
  companyName?: string
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const reportTypeLabel =
    reportType === "location"
      ? "Location"
      : reportType === "sublocation"
      ? "Sub-Location"
      : "Department";

  // ===== PAGE 1: Header, KPIs, Asset Count Table =====

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`ASSET ${reportTypeLabel.toUpperCase()} REPORT`, pageWidth / 2, 20, {
    align: "center",
  });

  if (companyName) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(companyName, pageWidth / 2, 28, { align: "center" });
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`, pageWidth / 2, 35, { align: "center" });

  doc.setTextColor(0, 0, 0);

  // KPI Summary
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("KPI SUMMARY", margin, 48);

  const kpiData = [
    ["Total Assets", kpis.totalAssets.toLocaleString()],
    ["Total Value", `Rs. ${kpis.totalValue.toLocaleString()}`],
    [`${reportTypeLabel}s`, kpis.locationCount.toString()],
    ["Utilization Rate", `${kpis.overallUtilization.toFixed(1)}%`],
    [`Top ${reportTypeLabel}`, kpis.topLocation],
    ["Avg Value per Location", `Rs. ${Math.round(kpis.avgValuePerLocation).toLocaleString()}`],
  ];

  autoTable(doc, {
    startY: 52,
    head: [],
    body: kpiData,
    theme: "plain",
    styles: { fontSize: 9 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45 },
      1: { cellWidth: 50 },
    },
    margin: { left: margin },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 10;

  // Asset Count Table (replaces bar chart)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Assets by ${reportTypeLabel} (Top ${chartData.assetCountData.length})`, margin, currentY);
  currentY += 4;

  const sortedAssetCount = [...chartData.assetCountData].sort((a, b) => b.value - a.value);
  const assetCountTotal = sortedAssetCount.reduce((sum, d) => sum + d.value, 0);

  autoTable(doc, {
    startY: currentY,
    head: [[reportTypeLabel, "Asset Count", "% of Total"]],
    body: sortedAssetCount.map((item) => [
      item.name,
      item.value.toLocaleString(),
      `${((item.value / assetCountTotal) * 100).toFixed(1)}%`,
    ]),
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
    styles: { fontSize: 8 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // ===== PAGE 2: Value Distribution + Status Distribution Tables =====
  if (currentY > pageHeight - 80) {
    doc.addPage();
    currentY = 20;
  }

  // Value Distribution Table (replaces pie chart)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Value Distribution", margin, currentY);
  currentY += 4;

  const totalValue = chartData.valueDistribution.reduce((sum, d) => sum + d.value, 0);

  autoTable(doc, {
    startY: currentY,
    head: [[reportTypeLabel, "Value (Rs.)", "% of Total"]],
    body: chartData.valueDistribution.map((item) => [
      item.name,
      item.value.toLocaleString(),
      `${((item.value / (totalValue || 1)) * 100).toFixed(1)}%`,
    ]),
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
    styles: { fontSize: 8 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Status Distribution Table (replaces stacked bar chart)
  if (currentY > pageHeight - 80) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Status by ${reportTypeLabel}`, margin, currentY);
  currentY += 4;

  autoTable(doc, {
    startY: currentY,
    head: [[reportTypeLabel, "Active", "Maintenance", "Inactive", "Total"]],
    body: chartData.statusDistribution.map((item) => {
      const total = item.active + item.maintenance + item.inactive;
      return [
        item.name,
        item.active.toString(),
        item.maintenance.toString(),
        item.inactive.toString(),
        total.toString(),
      ];
    }),
    theme: "striped",
    headStyles: { fillColor: [107, 114, 128], fontSize: 9 },
    styles: { fontSize: 8 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // ===== NEXT PAGES: Summary Table (all locations) =====
  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`${reportTypeLabel.toUpperCase()} SUMMARY`, margin, currentY);
  currentY += 5;

  const summaryHeaders = [
    reportTypeLabel,
    "Assets",
    "Value (Rs.)",
    "Active",
    "Utilization",
  ];

  const summaryData = reportData.map((item) => [
    item.name,
    item.assetCount.toString(),
    item.totalValue.toLocaleString(),
    item.activeCount.toString(),
    `${item.utilizationRate.toFixed(0)}%`,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [summaryHeaders],
    body: summaryData,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
    styles: { fontSize: 8 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // ===== Remaining pages: Detailed breakdowns per location =====
  for (const location of reportData) {
    if (currentY > pageHeight - 100) {
      doc.addPage();
      currentY = 20;
    }

    // Location Header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, currentY - 4, pageWidth - margin * 2, 10, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(location.name, margin + 2, currentY + 3);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const locationInfo = `Assets: ${location.assetCount} | Value: Rs. ${location.totalValue.toLocaleString()} | Utilization: ${location.utilizationRate.toFixed(0)}%`;
    doc.text(locationInfo, pageWidth - margin - 2, currentY + 3, { align: "right" });

    currentY += 12;

    // Category Breakdown
    if (location.categoryBreakdown && location.categoryBreakdown.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Main Categories:", margin, currentY);
      currentY += 4;

      const categoryText = location.categoryBreakdown
        .map((cat) => `${cat.categoryName}: ${cat.assetCount}`)
        .join(" | ");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const splitText = doc.splitTextToSize(categoryText, pageWidth - margin * 2);
      doc.text(splitText, margin, currentY);
      currentY += splitText.length * 4 + 4;
    }

    // Subcategory Table
    if (location.subcategoryBreakdown && location.subcategoryBreakdown.length > 0) {
      if (currentY > pageHeight - 40) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Subcategory Analysis:", margin, currentY);
      currentY += 2;

      const subcatHeaders = ["Subcategory", "Category", "Assets", "Value", "Good", "Fair", "Poor"];
      const subcatData = location.subcategoryBreakdown.map((sub) => [
        sub.subcategoryName,
        sub.parentCategoryName,
        sub.assetCount.toString(),
        `Rs. ${sub.totalValue.toLocaleString()}`,
        sub.goodCondition.toString(),
        sub.fairCondition.toString(),
        sub.poorCondition.toString(),
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [subcatHeaders],
        body: subcatData,
        theme: "grid",
        headStyles: { fillColor: [107, 114, 128], fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 1 },
        margin: { left: margin, right: margin },
      });

      currentY = (doc as any).lastAutoTable.finalY + 6;
    }

    // Asset Master Breakdown
    if (location.assetMasterBreakdown && location.assetMasterBreakdown.length > 0) {
      if (currentY > pageHeight - 40) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Asset Master Items Detail:", margin, currentY);
      currentY += 2;

      const amHeaders = ["Item Name", "Brand", "Category", "Count", "Value", "Good", "Fair", "Poor"];
      const amData = location.assetMasterBreakdown.map((am) => [
        am.assetMasterName.length > 30 ? am.assetMasterName.substring(0, 30) + "..." : am.assetMasterName,
        am.brand || "—",
        am.categoryName || "—",
        am.assetCount.toString(),
        `Rs. ${am.totalValue.toLocaleString()}`,
        am.goodCondition.toString(),
        am.fairCondition.toString(),
        (am.poorCondition + am.needsRepair).toString(),
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [amHeaders],
        body: amData,
        theme: "grid",
        headStyles: { fillColor: [79, 70, 229], fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 1 },
        margin: { left: margin, right: margin },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    } else {
      currentY += 6;
    }
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
    doc.text(
      "Asset Management System",
      margin,
      pageHeight - 10
    );
  }

  // Save the PDF
  const fileName = `Asset_${reportTypeLabel}_Report_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
