import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { DailyStockAdjustment } from "@/hooks/construction/useDailyMaterialsActivity";

interface ReportData {
  report_number: string;
  report_type: string;
  report_date: string;
  period_start_date?: string;
  period_end_date?: string;
  status: string;
  weather_conditions?: string;
  temperature_high?: number;
  temperature_low?: number;
  labor_count?: number;
  skilled_workers?: number;
  unskilled_workers?: number;
  subcontractors?: number;
  visitors?: number;
  work_summary?: string;
  delays_issues?: string;
  safety_observations?: string;
  materials_received?: string;
  project?: {
    project_name?: string;
    project_code?: string;
  };
}

interface MaterialsData {
  adjustments: DailyStockAdjustment[];
}

export function exportSiteReportToPdf(report: ReportData, materials: MaterialsData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("DAILY SITE REPORT", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  // Report info
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Report #: ${report.report_number}`, 14, yPos);
  doc.text(`Type: ${report.report_type?.toUpperCase() || "DAILY"}`, pageWidth - 14, yPos, { align: "right" });
  yPos += 7;

  doc.text(`Project: ${report.project?.project_name || "N/A"}`, 14, yPos);
  doc.text(`Status: ${report.status?.toUpperCase() || "DRAFT"}`, pageWidth - 14, yPos, { align: "right" });
  yPos += 7;

  // Period
  const periodText = report.report_type === "daily" 
    ? format(new Date(report.report_date), "MMMM d, yyyy")
    : report.period_start_date && report.period_end_date
      ? `${format(new Date(report.period_start_date), "MMM d")} - ${format(new Date(report.period_end_date), "MMM d, yyyy")}`
      : format(new Date(report.report_date), "MMMM d, yyyy");
  doc.text(`Period: ${periodText}`, 14, yPos);
  yPos += 12;

  // Divider
  doc.setDrawColor(200);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 8;

  // Weather & Labor Section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Conditions & Workforce", 14, yPos);
  yPos += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  const weatherInfo = [
    ["Weather:", report.weather_conditions || "N/A"],
    ["Temperature:", report.temperature_high && report.temperature_low 
      ? `High: ${report.temperature_high}°F / Low: ${report.temperature_low}°F` 
      : "N/A"],
  ];
  
  const laborInfo = [
    ["Total Labor:", String(report.labor_count || 0)],
    ["Skilled Workers:", String(report.skilled_workers || 0)],
    ["Unskilled Workers:", String(report.unskilled_workers || 0)],
    ["Subcontractors:", String(report.subcontractors || 0)],
    ["Visitors:", String(report.visitors || 0)],
  ];

  weatherInfo.forEach(([label, value]) => {
    doc.text(`${label} ${value}`, 14, yPos);
    yPos += 5;
  });
  
  yPos += 2;
  laborInfo.forEach(([label, value]) => {
    doc.text(`${label} ${value}`, 14, yPos);
    yPos += 5;
  });
  yPos += 5;

  // Work Summary
  if (report.work_summary) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Work Summary", 14, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(report.work_summary, pageWidth - 28);
    doc.text(summaryLines, 14, yPos);
    yPos += summaryLines.length * 5 + 5;
  }

  // Delays/Issues
  if (report.delays_issues) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Delays/Issues", 14, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const delayLines = doc.splitTextToSize(report.delays_issues, pageWidth - 28);
    doc.text(delayLines, 14, yPos);
    yPos += delayLines.length * 5 + 5;
  }

  // Safety Observations
  if (report.safety_observations) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Safety Observations", 14, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const safetyLines = doc.splitTextToSize(report.safety_observations, pageWidth - 28);
    doc.text(safetyLines, 14, yPos);
    yPos += safetyLines.length * 5 + 5;
  }

  // Check if we need a new page for materials
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  // Stock Adjustments Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Stock Adjustments", 14, yPos);
  yPos += 10;

  // Stock Adjustments Table
  if (materials.adjustments.length > 0) {
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(10);
    doc.text("Stock Adjustments", 14, yPos);
    yPos += 2;

    autoTable(doc, {
      startY: yPos,
      head: [["Code", "Item", "Change", "Before", "After", "Notes"]],
      body: materials.adjustments.map((item) => [
        item.item_code || "-",
        item.item_name,
        item.quantity_change > 0 ? `+${item.quantity_change}` : String(item.quantity_change),
        String(item.quantity_before),
        String(item.quantity_after),
        item.adjustment_notes || "-",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [240, 173, 78] },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      `Generated on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")} | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save the PDF
  doc.save(`${report.report_number}.pdf`);
}
