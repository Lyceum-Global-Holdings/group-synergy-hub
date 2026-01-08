import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { DailyStockAdjustment, DailyMaterialIssue, CurrentStockBalance } from "@/hooks/construction/useDailyMaterialsActivity";

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
  skilled_labor_count?: number;
  unskilled_labor_count?: number;
  subcontractor_count?: number;
  visitor_count?: number;
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
  issues: DailyMaterialIssue[];
  stockBalances: CurrentStockBalance[];
}

function generatePdfDocument(report: ReportData, materials: MaterialsData): jsPDF {
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
    ["Total Labor:", String((report.skilled_labor_count || 0) + (report.unskilled_labor_count || 0))],
    ["Skilled:", String(report.skilled_labor_count || 0)],
    ["Non-Skilled:", String(report.unskilled_labor_count || 0)],
    ["Subcontractors:", String(report.subcontractor_count || 0)],
    ["Visitors:", String(report.visitor_count || 0)],
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

  // Items Issued Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Material Activity", 14, yPos);
  yPos += 10;

  // Separate items by supplier type
  const regularIssues = materials.issues.filter(i => !i.supplier_name);
  const supplierLinkedIssues = materials.issues.filter(i => i.supplier_name && i.supplier_type !== 'contractor');
  const contractorIssues = materials.issues.filter(i => i.supplier_type === 'contractor');

  // Items Issued Table (Regular Items - no supplier)
  if (regularIssues.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Items Issued (${regularIssues.length})`, 14, yPos);
    yPos += 2;

    autoTable(doc, {
      startY: yPos,
      head: [["MIN#", "Code", "Item", "Qty Issued", "Issued To", "Department"]],
      body: regularIssues.map((item) => [
        item.min_number || "-",
        item.item_code || "-",
        item.item_name,
        String(item.quantity_issued),
        item.issued_to || "-",
        item.department || "-",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Supplier-Linked Items Table (non-contractor suppliers)
  if (supplierLinkedIssues.length > 0) {
    // Check if we need a new page
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Supplier-Linked Items (${supplierLinkedIssues.length})`, 14, yPos);
    yPos += 2;

    autoTable(doc, {
      startY: yPos,
      head: [["MIN#", "Code", "Item", "Qty Issued", "Supplier", "Issued To"]],
      body: supplierLinkedIssues.map((item) => [
        item.min_number || "-",
        item.item_code || "-",
        item.item_name,
        String(item.quantity_issued),
        item.supplier_name || "-",
        item.issued_to || "-",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [52, 152, 219] }, // Blue color for supplier-linked items
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Contractor Supplied Items Table
  if (contractorIssues.length > 0) {
    // Check if we need a new page
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Contractor Supplied Items (${contractorIssues.length})`, 14, yPos);
    yPos += 2;

    autoTable(doc, {
      startY: yPos,
      head: [["MIN#", "Code", "Item", "Qty Issued", "Supplier", "Issued To"]],
      body: contractorIssues.map((item) => [
        item.min_number || "-",
        item.item_code || "-",
        item.item_name,
        String(item.quantity_issued),
        item.supplier_name || "-",
        item.issued_to || "-",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [230, 126, 34] }, // Orange color for contractor items
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Check if we need a new page
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }

  // Stock Transactions - Split by Supplier
  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      adjustment: "Adjustment",
      goods_receipt: "Goods Receipt",
      opening_stock: "Opening Stock",
      transfer_in: "Transfer In",
      transfer_out: "Transfer Out",
      project_issue: "Project Issue",
      project_return: "Project Return",
      sublocation_issue: "Sub-Location Issue",
    };
    return labels[type] || type.replace(/_/g, ' ');
  };

  const regularAdjustments = materials.adjustments.filter(a => !a.supplier_name);
  const supplierLinkedAdjustments = materials.adjustments.filter(a => a.supplier_name && a.supplier_type !== 'contractor');
  const contractorAdjustments = materials.adjustments.filter(a => a.supplier_type === 'contractor');

  // Regular Stock Transactions (no supplier)
  if (regularAdjustments.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Stock Transactions (${regularAdjustments.length})`, 14, yPos);
    yPos += 2;

    autoTable(doc, {
      startY: yPos,
      head: [["Type", "Code", "Item", "Change", "Before", "After", "Notes", "By"]],
      body: regularAdjustments.map((item) => {
        const notes = item.issued_to_location_name 
          ? `To: ${item.issued_to_location_name}${item.adjustment_notes ? ` - ${item.adjustment_notes}` : ""}`
          : item.adjustment_notes || "-";
        return [
          getTypeLabel(item.transaction_type || "adjustment"),
          item.item_code || "-",
          item.item_name,
          item.quantity_change > 0 ? `+${item.quantity_change}` : String(item.quantity_change),
          String(item.quantity_before),
          String(item.quantity_after),
          notes,
          item.adjusted_by || "-",
        ];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Supplier-Linked Stock Transactions
  if (supplierLinkedAdjustments.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Supplier-Linked Stock Transactions (${supplierLinkedAdjustments.length})`, 14, yPos);
    yPos += 2;

    autoTable(doc, {
      startY: yPos,
      head: [["Type", "Code", "Item", "Supplier", "Change", "Before", "After", "Notes", "By"]],
      body: supplierLinkedAdjustments.map((item) => {
        const notes = item.issued_to_location_name 
          ? `To: ${item.issued_to_location_name}${item.adjustment_notes ? ` - ${item.adjustment_notes}` : ""}`
          : item.adjustment_notes || "-";
        return [
          getTypeLabel(item.transaction_type || "adjustment"),
          item.item_code || "-",
          item.item_name,
          item.supplier_name || "-",
          item.quantity_change > 0 ? `+${item.quantity_change}` : String(item.quantity_change),
          String(item.quantity_before),
          String(item.quantity_after),
          notes,
          item.adjusted_by || "-",
        ];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [52, 152, 219] },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Contractor Stock Transactions
  if (contractorAdjustments.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Contractor Stock Transactions (${contractorAdjustments.length})`, 14, yPos);
    yPos += 2;

    autoTable(doc, {
      startY: yPos,
      head: [["Type", "Code", "Item", "Supplier", "Change", "Before", "After", "Notes", "By"]],
      body: contractorAdjustments.map((item) => {
        const notes = item.issued_to_location_name 
          ? `To: ${item.issued_to_location_name}${item.adjustment_notes ? ` - ${item.adjustment_notes}` : ""}`
          : item.adjustment_notes || "-";
        return [
          getTypeLabel(item.transaction_type || "adjustment"),
          item.item_code || "-",
          item.item_name,
          item.supplier_name || "-",
          item.quantity_change > 0 ? `+${item.quantity_change}` : String(item.quantity_change),
          String(item.quantity_before),
          String(item.quantity_after),
          notes,
          item.adjusted_by || "-",
        ];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [230, 126, 34] },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Check if we need a new page for stock balances
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  // Current Stock Balances Section
  if (materials.stockBalances.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Current Stock Balances", 14, yPos);
    yPos += 8;

    // Sort stock balances by item name first, then by warehouse
    const sortedStockBalances = [...materials.stockBalances].sort((a, b) => {
      const nameA = a.item_name || "";
      const nameB = b.item_name || "";
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB);
      }
      const warehouseA = a.warehouse_name || "Unassigned";
      const warehouseB = b.warehouse_name || "Unassigned";
      return warehouseA.localeCompare(warehouseB);
    });

    // Calculate total stock per item (across all warehouses)
    const itemTotals = materials.stockBalances.reduce((acc, item) => {
      const itemCode = item.item_code || "unknown";
      if (!acc[itemCode]) {
        acc[itemCode] = 0;
      }
      acc[itemCode] += item.current_stock;
      return acc;
    }, {} as Record<string, number>);

    // Group sorted stock balances by warehouse
    const stockByWarehouse = sortedStockBalances.reduce((acc, item) => {
      const warehouseName = item.warehouse_name || "Unassigned";
      if (!acc[warehouseName]) {
        acc[warehouseName] = { items: [] as CurrentStockBalance[], totalStock: 0 };
      }
      acc[warehouseName].items.push(item);
      acc[warehouseName].totalStock += item.current_stock;
      return acc;
    }, {} as Record<string, { items: CurrentStockBalance[]; totalStock: number }>);

    // Warehouse Summary Table
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Stock by Warehouse", 14, yPos);
    yPos += 2;

    const warehouseSummary = Object.entries(stockByWarehouse).map(([name, data]) => [
      name,
      String(data.items.length),
      String(data.totalStock),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Warehouse", "Items Count", "Total Stock"]],
      body: warehouseSummary,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [92, 184, 92] },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Detailed Stock Balances
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Detailed Stock Balances", 14, yPos);
    yPos += 2;

    autoTable(doc, {
      startY: yPos,
      head: [["Code", "Item", "Current Stock", "Warehouse", "Total Stock"]],
      body: sortedStockBalances.map((item) => [
        item.item_code || "-",
        item.item_name,
        String(item.current_stock),
        item.warehouse_name || "Unassigned",
        String(itemTotals[item.item_code || "unknown"] || 0),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [91, 192, 222] },
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

  return doc;
}

export function exportSiteReportToPdf(report: ReportData, materials: MaterialsData) {
  const doc = generatePdfDocument(report, materials);
  doc.save(`${report.report_number}.pdf`);
}

export function generateSiteReportPdfBase64(report: ReportData, materials: MaterialsData): string {
  const doc = generatePdfDocument(report, materials);
  // Get base64 string from data URI (removes "data:application/pdf;base64," prefix)
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
}
