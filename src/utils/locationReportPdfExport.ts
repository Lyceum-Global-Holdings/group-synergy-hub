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

// Canvas-based chart rendering utilities
function drawBarChart(
  ctx: CanvasRenderingContext2D,
  data: { name: string; value: number }[],
  width: number,
  height: number,
  title: string,
  barColor: string = "#3b82f6"
): void {
  const padding = { top: 40, right: 30, bottom: 80, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Clear and set background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 28);

  if (data.length === 0) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px Arial";
    ctx.fillText("No data available", width / 2, height / 2);
    return;
  }

  const maxValue = Math.max(...data.map((d) => d.value));
  const barWidth = Math.min(50, chartWidth / data.length - 10);

  // Draw bars
  data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = padding.left + (chartWidth / data.length) * index + barWidth / 2;
    const y = padding.top + chartHeight - barHeight;

    ctx.fillStyle = barColor;
    ctx.fillRect(x, y, barWidth, barHeight);

    // Value label
    ctx.fillStyle = "#1f2937";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(item.value.toLocaleString(), x + barWidth / 2, y - 5);

    // X-axis label
    ctx.save();
    ctx.translate(x + barWidth / 2, padding.top + chartHeight + 10);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = "right";
    ctx.fillStyle = "#4b5563";
    ctx.font = "10px Arial";
    const label = item.name.length > 18 ? item.name.substring(0, 18) + "..." : item.name;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  // Y-axis
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartHeight);
  ctx.stroke();

  // Y-axis labels
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const value = Math.round((maxValue / steps) * i);
    const y = padding.top + chartHeight - (chartHeight / steps) * i;
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px Arial";
    ctx.textAlign = "right";
    ctx.fillText(value.toLocaleString(), padding.left - 5, y + 4);

    // Grid line
    ctx.strokeStyle = "#f3f4f6";
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }
}

function drawPieChart(
  ctx: CanvasRenderingContext2D,
  data: { name: string; value: number }[],
  width: number,
  height: number,
  title: string
): void {
  const centerX = width / 2;
  const centerY = height / 2 - 10;
  const radius = Math.min(width, height) / 3;

  // Clear and set background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 28);

  if (data.length === 0) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px Arial";
    ctx.fillText("No data available", width / 2, height / 2);
    return;
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const colors = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
    "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
    "#d946ef", "#14b8a6", "#f97316", "#6366f1",
  ];

  let startAngle = -Math.PI / 2;

  data.forEach((item, index) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;

    // Draw slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();

    // Draw label
    const labelAngle = startAngle + sliceAngle / 2;
    const labelRadius = radius * 0.7;
    const labelX = centerX + Math.cos(labelAngle) * labelRadius;
    const labelY = centerY + Math.sin(labelAngle) * labelRadius;

    ctx.fillStyle = "#ffffff";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    const percent = ((item.value / total) * 100).toFixed(0);
    if (parseFloat(percent) > 4) {
      ctx.fillText(`${percent}%`, labelX, labelY);
    }

    startAngle = endAngle;
  });

  // Legend - 3 columns with more space
  const legendStartY = height - 80;
  const legendStartX = 20;
  const cols = 3;
  const itemWidth = (width - 40) / cols;

  data.forEach((item, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = legendStartX + col * itemWidth;
    const y = legendStartY + row * 18;

    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(x, y, 10, 10);

    ctx.fillStyle = "#4b5563";
    ctx.font = "10px Arial";
    ctx.textAlign = "left";
    const label = item.name.length > 18 ? item.name.substring(0, 18) + "..." : item.name;
    ctx.fillText(label, x + 14, y + 9);
  });
}

function drawStackedBarChart(
  ctx: CanvasRenderingContext2D,
  data: { name: string; active: number; maintenance: number; inactive: number }[],
  width: number,
  height: number,
  title: string
): void {
  const padding = { top: 50, right: 30, bottom: 100, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Clear and set background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 28);

  if (data.length === 0) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px Arial";
    ctx.fillText("No data available", width / 2, height / 2);
    return;
  }

  const maxValue = Math.max(...data.map((d) => d.active + d.maintenance + d.inactive));
  const barWidth = Math.min(45, chartWidth / data.length - 8);

  const colors = {
    active: "#22c55e",
    maintenance: "#f59e0b",
    inactive: "#ef4444",
  };

  data.forEach((item, index) => {
    const x = padding.left + (chartWidth / data.length) * index + barWidth / 2;
    let currentY = padding.top + chartHeight;

    // Active
    const activeHeight = (item.active / maxValue) * chartHeight;
    ctx.fillStyle = colors.active;
    ctx.fillRect(x, currentY - activeHeight, barWidth, activeHeight);
    currentY -= activeHeight;

    // Maintenance
    const maintenanceHeight = (item.maintenance / maxValue) * chartHeight;
    ctx.fillStyle = colors.maintenance;
    ctx.fillRect(x, currentY - maintenanceHeight, barWidth, maintenanceHeight);
    currentY -= maintenanceHeight;

    // Inactive
    const inactiveHeight = (item.inactive / maxValue) * chartHeight;
    ctx.fillStyle = colors.inactive;
    ctx.fillRect(x, currentY - inactiveHeight, barWidth, inactiveHeight);

    // X-axis label
    ctx.save();
    ctx.translate(x + barWidth / 2, padding.top + chartHeight + 10);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = "right";
    ctx.fillStyle = "#4b5563";
    ctx.font = "10px Arial";
    const label = item.name.length > 18 ? item.name.substring(0, 18) + "..." : item.name;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  // Legend
  const legendY = padding.top - 5;
  const legends = [
    { label: "Active", color: colors.active },
    { label: "Maintenance", color: colors.maintenance },
    { label: "Inactive", color: colors.inactive },
  ];

  let legendX = width - 280;
  legends.forEach((leg) => {
    ctx.fillStyle = leg.color;
    ctx.fillRect(legendX, legendY - 8, 10, 10);
    ctx.fillStyle = "#4b5563";
    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    ctx.fillText(leg.label, legendX + 14, legendY);
    legendX += 80;
  });
}

function drawSubcategoryConditionChart(
  ctx: CanvasRenderingContext2D,
  data: SubcategoryBreakdown[],
  width: number,
  height: number,
  title: string
): void {
  const padding = { top: 50, right: 30, bottom: 100, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Clear and set background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 28);

  if (data.length === 0) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px Arial";
    ctx.fillText("No data available", width / 2, height / 2);
    return;
  }

  const maxValue = Math.max(
    ...data.map((d) => d.goodCondition + d.fairCondition + d.poorCondition + d.needsRepair)
  );
  const barWidth = Math.min(40, chartWidth / data.length - 6);

  const colors = {
    good: "#22c55e",
    fair: "#f59e0b",
    poor: "#ef4444",
    needsRepair: "#dc2626",
  };

  data.forEach((item, index) => {
    const x = padding.left + (chartWidth / data.length) * index + barWidth / 2;
    let currentY = padding.top + chartHeight;

    // Good
    const goodHeight = (item.goodCondition / maxValue) * chartHeight;
    ctx.fillStyle = colors.good;
    ctx.fillRect(x, currentY - goodHeight, barWidth, goodHeight);
    currentY -= goodHeight;

    // Fair
    const fairHeight = (item.fairCondition / maxValue) * chartHeight;
    ctx.fillStyle = colors.fair;
    ctx.fillRect(x, currentY - fairHeight, barWidth, fairHeight);
    currentY -= fairHeight;

    // Poor
    const poorHeight = (item.poorCondition / maxValue) * chartHeight;
    ctx.fillStyle = colors.poor;
    ctx.fillRect(x, currentY - poorHeight, barWidth, poorHeight);
    currentY -= poorHeight;

    // Needs Repair
    const repairHeight = (item.needsRepair / maxValue) * chartHeight;
    ctx.fillStyle = colors.needsRepair;
    ctx.fillRect(x, currentY - repairHeight, barWidth, repairHeight);

    // X-axis label
    ctx.save();
    ctx.translate(x + barWidth / 2, padding.top + chartHeight + 10);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = "right";
    ctx.fillStyle = "#4b5563";
    ctx.font = "10px Arial";
    const label = item.subcategoryName.length > 18
      ? item.subcategoryName.substring(0, 18) + "..."
      : item.subcategoryName;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  // Legend
  const legendY = padding.top - 5;
  const legends = [
    { label: "Good", color: colors.good },
    { label: "Fair", color: colors.fair },
    { label: "Poor", color: colors.poor },
    { label: "Needs Repair", color: colors.needsRepair },
  ];

  let legendX = width - 340;
  legends.forEach((leg) => {
    ctx.fillStyle = leg.color;
    ctx.fillRect(legendX, legendY - 8, 10, 10);
    ctx.fillStyle = "#4b5563";
    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    ctx.fillText(leg.label, legendX + 14, legendY);
    legendX += 80;
  });
}

async function renderChartToImage(
  chartType: "bar" | "pie" | "stackedBar" | "conditionBar",
  data: any[],
  width: number,
  height: number,
  title: string
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  switch (chartType) {
    case "bar":
      drawBarChart(ctx, data, width, height, title);
      break;
    case "pie":
      drawPieChart(ctx, data, width, height, title);
      break;
    case "stackedBar":
      drawStackedBarChart(ctx, data, width, height, title);
      break;
    case "conditionBar":
      drawSubcategoryConditionChart(ctx, data, width, height, title);
      break;
  }

  return canvas.toDataURL("image/png");
}

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

  // ===== PAGE 1: Header, KPIs, Asset Count Bar Chart =====

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

  // Asset Count Bar Chart - full width
  try {
    const assetCountImage = await renderChartToImage(
      "bar",
      chartData.assetCountData,
      800,
      400,
      `Assets by ${reportTypeLabel}`
    );

    if (currentY > pageHeight - 70) {
      doc.addPage();
      currentY = 20;
    }
    doc.addImage(assetCountImage, "PNG", margin, currentY, 180, 60);
    currentY += 65;
  } catch (error) {
    console.error("Bar chart rendering error:", error);
  }

  // ===== PAGE 2: Pie Chart + Status Chart =====
  doc.addPage();
  currentY = 20;

  try {
    // Value Distribution Pie Chart - centered
    const valueDistImage = await renderChartToImage(
      "pie",
      chartData.valueDistribution,
      600,
      400,
      "Value Distribution"
    );
    doc.addImage(valueDistImage, "PNG", 30, currentY, 150, 70);
    currentY += 78;

    // Status Distribution Chart - full width
    if (currentY > pageHeight - 70) {
      doc.addPage();
      currentY = 20;
    }

    const statusImage = await renderChartToImage(
      "stackedBar",
      chartData.statusDistribution,
      800,
      400,
      `Status by ${reportTypeLabel}`
    );
    doc.addImage(statusImage, "PNG", margin, currentY, 180, 60);
    currentY += 65;
  } catch (error) {
    console.error("Chart rendering error:", error);
  }

  // ===== PAGE 3+: Summary Table (all locations) =====
  doc.addPage();
  currentY = 20;

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
    // Check for new page
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
      // Split long category text across lines
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
