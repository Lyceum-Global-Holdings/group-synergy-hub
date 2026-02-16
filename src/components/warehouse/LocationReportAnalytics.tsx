import { useMemo, useState, useRef, useCallback } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import html2canvas from "html2canvas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  MapPin,
  Building,
  Users,
  Package,
  DollarSign,
  TrendingUp,
  Download,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  FileText,
  Layers,
  Camera,
} from "lucide-react";
import { WarehouseAsset, WarehouseLocation, AssetCategory } from "@/types/warehouse";
import { toast } from "@/hooks/use-toast";
import { writeExcelFromJSON } from "@/utils/excelUtils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  exportLocationReportPdf,
  LocationReportData,
  CategoryBreakdown,
  SubcategoryBreakdown,
  AssetMasterBreakdown,
} from "@/utils/locationReportPdfExport";

interface LocationReportAnalyticsProps {
  assets: WarehouseAsset[];
  locations: WarehouseLocation[];
  categories: AssetCategory[];
}

interface LocationAnalyticsData {
  id: string;
  name: string;
  locationCode?: string | null;
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
  // Category and subcategory breakdowns
  categoryBreakdown: CategoryBreakdown[];
  subcategoryBreakdown: SubcategoryBreakdown[];
  // Asset Master item-level breakdown
  assetMasterBreakdown: AssetMasterBreakdown[];
}

type ReportType = "location" | "sublocation" | "department";

const COLORS = [
  "hsl(217, 91%, 60%)", // Primary
  "hsl(199, 89%, 48%)", // Info
  "hsl(142, 76%, 36%)", // Success
  "hsl(38, 92%, 50%)", // Warning
  "hsl(0, 84%, 60%)", // Destructive
  "hsl(280, 85%, 60%)", // Purple
  "hsl(340, 82%, 52%)", // Pink
  "hsl(24, 95%, 53%)", // Orange
];

const CONDITION_COLORS = {
  good: "hsl(142, 76%, 36%)",
  fair: "hsl(38, 92%, 50%)",
  poor: "hsl(0, 84%, 60%)",
  needsRepair: "hsl(0, 74%, 50%)",
};

const STATUS_COLORS = {
  active: "hsl(142, 76%, 36%)",
  maintenance: "hsl(38, 92%, 50%)",
  inactive: "hsl(0, 84%, 60%)",
  disposed: "hsl(240, 5%, 46%)",
};

export function LocationReportAnalytics({
  assets,
  locations,
  categories,
}: LocationReportAnalyticsProps) {
  const { formatCurrency } = useCompany();
  const [reportType, setReportType] = useState<ReportType>("location");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedSublocation, setSelectedSublocation] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isCapturing, setIsCapturing] = useState<string | null>(null);
  const [isCapturingPdf, setIsCapturingPdf] = useState<string | null>(null);
  
  // Refs for capturing location detail sections
  const detailRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Function to capture expanded section as JPG
  const handleCaptureAsJpg = useCallback(async (locationId: string, locationName: string) => {
    const element = detailRefs.current[locationId];
    if (!element) {
      toast({
        title: "Capture Failed",
        description: "Could not find the section to capture.",
        variant: "destructive",
      });
      return;
    }

    setIsCapturing(locationId);
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      // Convert to JPG and download
      const link = document.createElement("a");
      link.download = `${locationName.replace(/\s+/g, "_")}_Report_${new Date().toISOString().split("T")[0]}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
      
      toast({
        title: "Download Complete",
        description: `Location report saved as JPG.`,
      });
    } catch (error) {
      console.error("Capture error:", error);
      toast({
        title: "Capture Failed",
        description: "Failed to capture the section. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCapturing(null);
    }
  }, []);

  // handleCaptureAsPdf is defined after analyticsData below

  // Get locations by type
  const mainLocations = useMemo(
    () => locations.filter((loc) => loc.type === "location"),
    [locations]
  );

  const sublocations = useMemo(() => {
    if (selectedLocation === "all") {
      return locations.filter((loc) => loc.type === "sublocation");
    }
    return locations.filter(
      (loc) => loc.type === "sublocation" && loc.parent_id === selectedLocation
    );
  }, [locations, selectedLocation]);

  const departments = useMemo(() => {
    if (selectedSublocation === "all") {
      if (selectedLocation === "all") {
        return locations.filter((loc) => loc.type === "department");
      }
      // Get departments under selected location's sublocations
      const sublocationIds = locations
        .filter((loc) => loc.type === "sublocation" && loc.parent_id === selectedLocation)
        .map((loc) => loc.id);
      return locations.filter(
        (loc) => loc.type === "department" && sublocationIds.includes(loc.parent_id || "")
      );
    }
    return locations.filter(
      (loc) => loc.type === "department" && loc.parent_id === selectedSublocation
    );
  }, [locations, selectedLocation, selectedSublocation]);

  // Filter assets based on selected filters
  const filteredAssets = useMemo(() => {
    let result = [...assets];

    if (selectedLocation !== "all") {
      result = result.filter((a) => a.location_id === selectedLocation);
    }

    if (selectedSublocation !== "all") {
      result = result.filter((a) => a.sublocation_id === selectedSublocation);
    }

    if (selectedStatus !== "all") {
      result = result.filter((a) => a.status === selectedStatus);
    }

    return result;
  }, [assets, selectedLocation, selectedSublocation, selectedStatus]);

  // Calculate analytics data based on report type
  const analyticsData = useMemo(() => {
    const OTHER_KEY = "__other__";

    const getGroupingKey = (asset: WarehouseAsset): string | null => {
      switch (reportType) {
        case "location":
          return asset.location_id || null;
        case "sublocation":
          return asset.sublocation_id || OTHER_KEY;
        case "department":
          return asset.department_id || OTHER_KEY;
        default:
          return null;
      }
    };

    const getGroupingLocations = (): WarehouseLocation[] => {
      switch (reportType) {
        case "location":
          return mainLocations;
        case "sublocation":
          return sublocations;
        case "department":
          return departments;
        default:
          return [];
      }
    };

    const groupingLocations = getGroupingLocations();

    // Create category and subcategory lookup maps
    const mainCategories = categories.filter((c) => !c.parent_id);
    const subcategoryEntries = categories.filter((c) => c.parent_id);
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // Group assets
    const groupedData: Record<string, LocationAnalyticsData> = {};

    // Initialize all locations with zero counts
    groupingLocations.forEach((loc) => {
      const parentLoc = locations.find((l) => l.id === loc.parent_id);
      groupedData[loc.id] = {
        id: loc.id,
        name: loc.name,
        locationCode: loc.location_code,
        parentId: loc.parent_id,
        parentName: parentLoc?.name,
        assetCount: 0,
        totalValue: 0,
        activeCount: 0,
        maintenanceCount: 0,
        inactiveCount: 0,
        disposedCount: 0,
        goodCondition: 0,
        fairCondition: 0,
        poorCondition: 0,
        needsRepairCondition: 0,
        utilizationRate: 0,
        categoryBreakdown: [],
        subcategoryBreakdown: [],
        assetMasterBreakdown: [],
      };
    });

    // Add synthetic "Other" group for sublocation/department reports
    if (reportType === "sublocation" || reportType === "department") {
      groupedData[OTHER_KEY] = {
        id: OTHER_KEY,
        name: "Other",
        locationCode: null,
        parentId: null,
        parentName: reportType === "sublocation"
          ? (selectedLocation !== "all" ? locations.find(l => l.id === selectedLocation)?.name : undefined)
          : undefined,
        assetCount: 0,
        totalValue: 0,
        activeCount: 0,
        maintenanceCount: 0,
        inactiveCount: 0,
        disposedCount: 0,
        goodCondition: 0,
        fairCondition: 0,
        poorCondition: 0,
        needsRepairCondition: 0,
        utilizationRate: 0,
        categoryBreakdown: [],
        subcategoryBreakdown: [],
        assetMasterBreakdown: [],
      };
    }

    // Track category/subcategory counts per location
    const locationCategoryData: Record<
      string,
      Record<string, { count: number; value: number }>
    > = {};
    const locationSubcategoryData: Record<
      string,
      Record<
        string,
        {
          count: number;
          value: number;
          good: number;
          fair: number;
          poor: number;
          needsRepair: number;
          parentCategoryId: string | null;
        }
      >
    > = {};
    // Track Asset Master item data per location
    const locationAssetMasterData: Record<
      string,
      Record<
        string,
        {
          assetMasterName: string;
          brand: string | null;
          categoryId: string | null;
          subcategoryId: string | null;
          count: number;
          value: number;
          good: number;
          fair: number;
          poor: number;
          needsRepair: number;
        }
      >
    > = {};

    // Aggregate asset data
    filteredAssets.forEach((asset) => {
      const key = getGroupingKey(asset);
      if (key && groupedData[key]) {
        const data = groupedData[key];
        data.assetCount++;
        data.totalValue += asset.current_value || asset.purchase_price || 0;

        // Status counts
        if (asset.status === "active") data.activeCount++;
        else if (asset.status === "maintenance") data.maintenanceCount++;
        else if (asset.status === "inactive") data.inactiveCount++;
        else if (asset.status === "disposed") data.disposedCount++;

        // Condition counts
        if (asset.condition === "good") data.goodCondition++;
        else if (asset.condition === "fair") data.fairCondition++;
        else if (asset.condition === "poor") data.poorCondition++;
        else if (asset.condition === "needs_repair") data.needsRepairCondition++;

        // Category tracking
        if (asset.category_id) {
          if (!locationCategoryData[key]) locationCategoryData[key] = {};
          if (!locationCategoryData[key][asset.category_id]) {
            locationCategoryData[key][asset.category_id] = { count: 0, value: 0 };
          }
          locationCategoryData[key][asset.category_id].count++;
          locationCategoryData[key][asset.category_id].value +=
            asset.current_value || asset.purchase_price || 0;
        }

        // Subcategory tracking
        if (asset.subcategory_id) {
          if (!locationSubcategoryData[key]) locationSubcategoryData[key] = {};
          if (!locationSubcategoryData[key][asset.subcategory_id]) {
            const subcat = categoryMap.get(asset.subcategory_id);
            locationSubcategoryData[key][asset.subcategory_id] = {
              count: 0,
              value: 0,
              good: 0,
              fair: 0,
              poor: 0,
              needsRepair: 0,
              parentCategoryId: subcat?.parent_id || null,
            };
          }
          const subcatData = locationSubcategoryData[key][asset.subcategory_id];
          subcatData.count++;
          subcatData.value += asset.current_value || asset.purchase_price || 0;
          if (asset.condition === "good") subcatData.good++;
          else if (asset.condition === "fair") subcatData.fair++;
          else if (asset.condition === "poor") subcatData.poor++;
          else if (asset.condition === "needs_repair") subcatData.needsRepair++;
        }

        // Asset Master tracking
        if (asset.asset_master_id) {
          if (!locationAssetMasterData[key]) locationAssetMasterData[key] = {};
          if (!locationAssetMasterData[key][asset.asset_master_id]) {
            locationAssetMasterData[key][asset.asset_master_id] = {
              assetMasterName: asset.name,
              brand: asset.brand,
              categoryId: asset.category_id,
              subcategoryId: asset.subcategory_id,
              count: 0,
              value: 0,
              good: 0,
              fair: 0,
              poor: 0,
              needsRepair: 0,
            };
          }
          const amData = locationAssetMasterData[key][asset.asset_master_id];
          amData.count++;
          amData.value += asset.current_value || asset.purchase_price || 0;
          if (asset.condition === "good") amData.good++;
          else if (asset.condition === "fair") amData.fair++;
          else if (asset.condition === "poor") amData.poor++;
          else if (asset.condition === "needs_repair") amData.needsRepair++;
        }
      }
    });

    // Remove "Other" if it has no assets
    if (groupedData[OTHER_KEY] && groupedData[OTHER_KEY].assetCount === 0) {
      delete groupedData[OTHER_KEY];
    }

    // Build category and subcategory breakdowns for each location
    Object.keys(groupedData).forEach((locId) => {
      // Category breakdown
      if (locationCategoryData[locId]) {
        groupedData[locId].categoryBreakdown = Object.entries(locationCategoryData[locId])
          .map(([catId, catData]) => {
            const cat = categoryMap.get(catId);
            return {
              categoryId: catId,
              categoryName: cat?.name || "Unknown",
              assetCount: catData.count,
              totalValue: catData.value,
            };
          })
          .sort((a, b) => b.assetCount - a.assetCount);
      }

      // Subcategory breakdown
      if (locationSubcategoryData[locId]) {
        groupedData[locId].subcategoryBreakdown = Object.entries(locationSubcategoryData[locId])
          .map(([subcatId, subcatData]) => {
            const subcat = categoryMap.get(subcatId);
            const parentCat = subcatData.parentCategoryId
              ? categoryMap.get(subcatData.parentCategoryId)
              : null;
            return {
              subcategoryId: subcatId,
              subcategoryName: subcat?.name || "Unknown",
              parentCategoryName: parentCat?.name || "Unknown",
              assetCount: subcatData.count,
              totalValue: subcatData.value,
              goodCondition: subcatData.good,
              fairCondition: subcatData.fair,
              poorCondition: subcatData.poor,
              needsRepair: subcatData.needsRepair,
            };
          })
          .sort((a, b) => b.assetCount - a.assetCount);
      }

      // Asset Master breakdown
      if (locationAssetMasterData[locId]) {
        groupedData[locId].assetMasterBreakdown = Object.entries(locationAssetMasterData[locId])
          .map(([amId, amData]) => {
            const cat = amData.categoryId ? categoryMap.get(amData.categoryId) : null;
            const subcat = amData.subcategoryId ? categoryMap.get(amData.subcategoryId) : null;
            return {
              assetMasterId: amId,
              assetMasterName: amData.assetMasterName,
              brand: amData.brand,
              categoryName: cat?.name || null,
              subcategoryName: subcat?.name || null,
              assetCount: amData.count,
              totalValue: amData.value,
              goodCondition: amData.good,
              fairCondition: amData.fair,
              poorCondition: amData.poor,
              needsRepair: amData.needsRepair,
            };
          })
          .sort((a, b) => b.assetCount - a.assetCount);
      }
    });

    // Calculate utilization rates
    Object.values(groupedData).forEach((data) => {
      data.utilizationRate =
        data.assetCount > 0 ? (data.activeCount / data.assetCount) * 100 : 0;
    });
    const dataArray = Object.values(groupedData).filter((d) => d.assetCount > 0);
    const sortedByCount = [...dataArray].sort((a, b) => b.assetCount - a.assetCount);
    const sortedByValue = [...dataArray].sort((a, b) => b.totalValue - a.totalValue);

    // KPIs
    const totalAssets = filteredAssets.length;
    const totalValue = filteredAssets.reduce(
      (sum, a) => sum + (a.current_value || a.purchase_price || 0),
      0
    );
    const topLocation = sortedByCount[0];
    const avgValuePerLocation =
      dataArray.length > 0 ? totalValue / dataArray.length : 0;
    const overallUtilization =
      totalAssets > 0
        ? (filteredAssets.filter((a) => a.status === "active").length / totalAssets) * 100
        : 0;

    // Chart data - Status distribution by location (for stacked bar)
    const statusByLocation = sortedByCount.slice(0, 10).map((loc) => ({
      name: loc.name.length > 15 ? loc.name.substring(0, 15) + "..." : loc.name,
      fullName: loc.name,
      Active: loc.activeCount,
      Maintenance: loc.maintenanceCount,
      Inactive: loc.inactiveCount,
      Disposed: loc.disposedCount,
    }));

    // Collect all unique subcategories across top locations for stacked bar chart
    const allSubcategories = new Set<string>();
    sortedByCount.slice(0, 10).forEach((loc) => {
      loc.subcategoryBreakdown.forEach((sub) => allSubcategories.add(sub.subcategoryName));
    });
    const subcategoryList = Array.from(allSubcategories).sort();

    // Build stacked data: each location gets a key per subcategory
    const subcategoryByLocation = sortedByCount.slice(0, 10).map((loc) => {
      const row: Record<string, string | number> = {
        name: (loc.locationCode || loc.name).length > 15 ? (loc.locationCode || loc.name).substring(0, 15) + "..." : (loc.locationCode || loc.name),
        fullName: loc.name,
      };
      subcategoryList.forEach((subName) => {
        const match = loc.subcategoryBreakdown.find((s) => s.subcategoryName === subName);
        row[subName] = match ? match.assetCount : 0;
      });
      return row;
    });

    // Pie chart data - Value distribution
    const valueDistribution = sortedByValue.slice(0, 8).map((loc, index) => ({
      name: loc.locationCode || loc.name,
      value: loc.totalValue,
      color: COLORS[index % COLORS.length],
    }));

    // Add "Others" if there are more than 8 locations
    if (sortedByValue.length > 8) {
      const othersValue = sortedByValue
        .slice(8)
        .reduce((sum, loc) => sum + loc.totalValue, 0);
      valueDistribution.push({
        name: "Others",
        value: othersValue,
        color: "hsl(240, 5%, 46%)",
      });
    }

    return {
      dataArray,
      sortedByCount,
      sortedByValue,
      statusByLocation,
      valueDistribution,
      subcategoryByLocation,
      subcategoryList,
      kpis: {
        totalAssets,
        totalValue,
        topLocation: topLocation?.name || "—",
        avgValuePerLocation,
        overallUtilization,
        locationCount: dataArray.length,
      },
    };
  }, [
    filteredAssets,
    reportType,
    mainLocations,
    sublocations,
    departments,
    locations,
    categories,
  ]);

  // Function to generate structured PDF for a location's detailed breakdown
  const handleCaptureAsPdf = useCallback((locationId: string, locationName: string) => {
    const item = analyticsData.sortedByCount.find((i) => i.id === locationId);
    if (!item) {
      toast({
        title: "Export Failed",
        description: "Could not find data for this location.",
        variant: "destructive",
      });
      return;
    }

    setIsCapturingPdf(locationId);
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 20;

      const reportTypeLabel = reportType === "location" ? "Location" : reportType === "sublocation" ? "Sub-Location" : "Department";
      // Uses formatCurrency from useCompany() context for correct system currency

      // --- Header ---
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(locationName, pageWidth / 2, y, { align: "center" });
      y += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`${reportTypeLabel} Asset Detail Report`, pageWidth / 2, y, { align: "center" });
      y += 5;
      if (item.parentName) {
        doc.text(`Parent: ${item.parentName}`, pageWidth / 2, y, { align: "center" });
        y += 5;
      }
      doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, pageWidth / 2, y, { align: "center" });
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
      doc.setTextColor(0, 0, 0);

      // --- KPI Summary ---
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Key Performance Indicators", margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Total Assets", "Total Value", "Active Assets", "Utilization Rate"]],
        body: [[
          item.assetCount.toString(),
          formatCurrency(item.totalValue),
          item.activeCount.toString(),
          `${item.utilizationRate.toFixed(1)}%`,
        ]],
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        bodyStyles: { fontSize: 10, halign: "center", fontStyle: "bold" },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // --- Status Breakdown ---
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Status Breakdown", margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Active", "Maintenance", "Inactive", "Disposed"]],
        body: [[
          item.activeCount.toString(),
          item.maintenanceCount.toString(),
          item.inactiveCount.toString(),
          item.disposedCount.toString(),
        ]],
        theme: "grid",
        headStyles: { fillColor: [34, 197, 94], fontSize: 9 },
        bodyStyles: { fontSize: 10, halign: "center" },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // --- Condition Breakdown ---
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Condition Breakdown", margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Good", "Fair", "Poor", "Needs Repair"]],
        body: [[
          item.goodCondition.toString(),
          item.fairCondition.toString(),
          item.poorCondition.toString(),
          item.needsRepairCondition.toString(),
        ]],
        theme: "grid",
        headStyles: { fillColor: [139, 92, 246], fontSize: 9 },
        bodyStyles: { fontSize: 10, halign: "center" },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // --- Value Metrics ---
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Value Metrics", margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Total Value", "Average Value per Asset"]],
        body: [[
          formatCurrency(item.totalValue),
          formatCurrency(item.assetCount > 0 ? item.totalValue / item.assetCount : 0),
        ]],
        theme: "grid",
        headStyles: { fillColor: [245, 158, 11], fontSize: 9, textColor: [0, 0, 0] },
        bodyStyles: { fontSize: 10, halign: "center", fontStyle: "bold" },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // --- Category Breakdown ---
      if (item.categoryBreakdown.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Category Breakdown", margin, y);
        y += 2;

        autoTable(doc, {
          startY: y,
          head: [["Category", "Assets", "Value"]],
          body: item.categoryBreakdown.map((cat) => [
            cat.categoryName,
            cat.assetCount.toString(),
            formatCurrency(cat.totalValue),
          ]),
          theme: "striped",
          headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // --- Subcategory Analysis ---
      if (item.subcategoryBreakdown.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Subcategory Analysis", margin, y);
        y += 2;

        autoTable(doc, {
          startY: y,
          head: [["Subcategory", "Parent Category", "Assets", "Value", "Good", "Fair", "Poor", "Needs Repair"]],
          body: item.subcategoryBreakdown.map((sub) => [
            sub.subcategoryName,
            sub.parentCategoryName,
            sub.assetCount.toString(),
            formatCurrency(sub.totalValue),
            sub.goodCondition.toString(),
            sub.fairCondition.toString(),
            sub.poorCondition.toString(),
            sub.needsRepair.toString(),
          ]),
          theme: "striped",
          headStyles: { fillColor: [139, 92, 246], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 28 },
          },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // --- Asset Master Items ---
      if (item.assetMasterBreakdown.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Asset Master Items", margin, y);
        y += 2;

        autoTable(doc, {
          startY: y,
          head: [["Item Name", "Brand", "Category", "Subcategory", "Count", "Value", "Good", "Fair", "Poor"]],
          body: item.assetMasterBreakdown.map((am) => [
            am.assetMasterName,
            am.brand || "-",
            am.categoryName || "-",
            am.subcategoryName || "-",
            am.assetCount.toString(),
            formatCurrency(am.totalValue),
            am.goodCondition.toString(),
            am.fairCondition.toString(),
            am.poorCondition.toString(),
          ]),
          theme: "striped",
          headStyles: { fillColor: [34, 197, 94], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 28 },
          },
          margin: { left: margin, right: margin },
        });
      }

      // --- Page numbers footer ---
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Page ${i} of ${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 5,
          { align: "center" }
        );
      }

      const fileName = `${locationName.replace(/\s+/g, "_")}_Detail_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);

      toast({
        title: "Download Complete",
        description: "Structured PDF report saved successfully.",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCapturingPdf(null);
    }
  }, [analyticsData, reportType, formatCurrency]);


  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const reportTypeLabel =
        reportType === "location"
          ? "Location"
          : reportType === "sublocation"
          ? "Sub-Location"
          : "Department";

      const exportData = analyticsData.sortedByCount.map((item) => {
        const baseData: Record<string, string | number> = {};

        if (reportType === "sublocation" || reportType === "department") {
          baseData["Parent Location"] = item.parentName || "—";
        }

        baseData[reportTypeLabel] = item.name;
        baseData["Total Assets"] = item.assetCount;
        baseData["Total Value (Rs.)"] = item.totalValue;
        baseData["Active"] = item.activeCount;
        baseData["Maintenance"] = item.maintenanceCount;
        baseData["Inactive"] = item.inactiveCount;
        baseData["Disposed"] = item.disposedCount;
        baseData["Good Condition"] = item.goodCondition;
        baseData["Fair Condition"] = item.fairCondition;
        baseData["Poor Condition"] = item.poorCondition;
        baseData["Needs Repair"] = item.needsRepairCondition;
        baseData["Utilization Rate (%)"] = Math.round(item.utilizationRate);

        return baseData;
      });

      const fileName = `Asset_${reportTypeLabel}_Report_${new Date().toISOString().split("T")[0]}`;
      await writeExcelFromJSON(exportData, fileName, `${reportTypeLabel} Report`);

      toast({
        title: "Export Successful",
        description: `${reportTypeLabel} report exported to Excel`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const reportData: LocationReportData[] = analyticsData.sortedByCount.map((item) => ({
        id: item.id,
        name: item.name,
        parentId: item.parentId,
        parentName: item.parentName,
        assetCount: item.assetCount,
        totalValue: item.totalValue,
        activeCount: item.activeCount,
        maintenanceCount: item.maintenanceCount,
        inactiveCount: item.inactiveCount,
        disposedCount: item.disposedCount,
        goodCondition: item.goodCondition,
        fairCondition: item.fairCondition,
        poorCondition: item.poorCondition,
        needsRepairCondition: item.needsRepairCondition,
        utilizationRate: item.utilizationRate,
        categoryBreakdown: item.categoryBreakdown,
        subcategoryBreakdown: item.subcategoryBreakdown,
        assetMasterBreakdown: item.assetMasterBreakdown || [],
      }));

      const chartData = {
        assetCountData: analyticsData.sortedByCount.slice(0, 10).map((loc) => ({
          name: loc.name,
          value: loc.assetCount,
        })),
        valueDistribution: analyticsData.valueDistribution.map((loc) => ({
          name: loc.name,
          value: loc.value,
        })),
        statusDistribution: analyticsData.statusByLocation.map((loc) => ({
          name: loc.name,
          active: loc.Active,
          maintenance: loc.Maintenance,
          inactive: loc.Inactive,
        })),
      };

      await exportLocationReportPdf(
        reportData,
        reportType,
        analyticsData.kpis,
        chartData
      );

      toast({
        title: "PDF Export Successful",
        description: "Location report exported as PDF with charts",
      });
    } catch (error) {
      console.error("PDF Export error:", error);
      toast({
        title: "PDF Export Failed",
        description: "Failed to export PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Reset dependent filters when parent filter changes
  const handleLocationChange = (value: string) => {
    setSelectedLocation(value);
    setSelectedSublocation("all");
  };

  const handleSublocationChange = (value: string) => {
    setSelectedSublocation(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-card border border-border p-3 rounded shadow-md">
          <p className="font-medium">{data?.fullName || label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-card border border-border p-3 rounded shadow-md">
          <p className="font-medium">{data?.name}</p>
          <p>Value: Rs. {data?.value?.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  if (assets.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No Assets Available</p>
          <p className="text-sm text-muted-foreground mt-2">
            Add assets to view location analytics
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Location Reports</h2>
          <p className="text-sm text-muted-foreground">
            Analyze asset distribution across locations, sub-locations, and departments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPdf} disabled={isExportingPdf}>
            <FileText className="mr-2 h-4 w-4" />
            {isExportingPdf ? "Exporting..." : "Export PDF"}
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export Excel"}
          </Button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <Tabs
        value={reportType}
        onValueChange={(value) => {
          setReportType(value as ReportType);
          setSelectedLocation("all");
          setSelectedSublocation("all");
          setSelectedStatus("all");
          setExpandedRows(new Set());
        }}
      >
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="location" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location
          </TabsTrigger>
          <TabsTrigger value="sublocation" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Sub-Location
          </TabsTrigger>
          <TabsTrigger value="department" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Department
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mt-4">
          {(reportType === "sublocation" || reportType === "department") && (
            <div className="w-48">
              <Select value={selectedLocation} onValueChange={handleLocationChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-50">
                  <SelectItem value="all">All Locations</SelectItem>
                  {mainLocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(reportType === "sublocation" || reportType === "department") && (
            <div className="w-48">
              <Select
                value={selectedSublocation}
                onValueChange={handleSublocationChange}
                disabled={selectedLocation === "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sub-Locations" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-50">
                  <SelectItem value="all">All Sub-Locations</SelectItem>
                  {sublocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="w-48">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="disposed">Disposed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content for all tabs */}
        <TabsContent value={reportType} className="mt-6">
          {analyticsData.dataArray.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No Data Available</p>
                <p className="text-sm text-muted-foreground mt-2">
                  No assets found for the selected filters
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.kpis.totalAssets.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Across {analyticsData.kpis.locationCount}{" "}
                      {reportType === "location"
                        ? "locations"
                        : reportType === "sublocation"
                        ? "sub-locations"
                        : "departments"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      Rs. {analyticsData.kpis.totalValue.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current asset value
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Top Location</CardTitle>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold truncate">
                      {analyticsData.kpis.topLocation}
                    </div>
                    <p className="text-xs text-muted-foreground">By asset count</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Utilization</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.kpis.overallUtilization.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Active assets rate</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Asset Count by Location */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Asset Count by{" "}
                      {reportType === "location"
                        ? "Location"
                        : reportType === "sublocation"
                        ? "Sub-Location"
                        : "Department"}
                    </CardTitle>
                    <CardDescription>
                      Distribution of assets across{" "}
                      {reportType === "location"
                        ? "locations"
                        : reportType === "sublocation"
                        ? "sub-locations"
                        : "departments"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={analyticsData.subcategoryByLocation}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          stroke="hsl(var(--foreground))"
                        />
                        <YAxis stroke="hsl(var(--foreground))" />
                        <Tooltip />
                        <Legend />
                        {analyticsData.subcategoryList.map((subName, index) => (
                          <Bar
                            key={subName}
                            dataKey={subName}
                            stackId="subcategories"
                            fill={COLORS[index % COLORS.length]}
                            name={subName}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Value Distribution Pie */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Value Distribution
                    </CardTitle>
                    <CardDescription>
                      Asset value share by{" "}
                      {reportType === "location"
                        ? "location"
                        : reportType === "sublocation"
                        ? "sub-location"
                        : "department"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analyticsData.valueDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name.length > 10 ? name.substring(0, 10) + "..." : name} ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {analyticsData.valueDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Status Distribution by Location */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Status Distribution
                    </CardTitle>
                    <CardDescription>
                      Asset status breakdown by{" "}
                      {reportType === "location"
                        ? "location"
                        : reportType === "sublocation"
                        ? "sub-location"
                        : "department"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analyticsData.statusByLocation}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          stroke="hsl(var(--foreground))"
                        />
                        <YAxis stroke="hsl(var(--foreground))" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar
                          dataKey="Active"
                          stackId="a"
                          fill={STATUS_COLORS.active}
                        />
                        <Bar
                          dataKey="Maintenance"
                          stackId="a"
                          fill={STATUS_COLORS.maintenance}
                        />
                        <Bar
                          dataKey="Inactive"
                          stackId="a"
                          fill={STATUS_COLORS.inactive}
                        />
                        <Bar
                          dataKey="Disposed"
                          stackId="a"
                          fill={STATUS_COLORS.disposed}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Locations by Value */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Top 10 by Value
                    </CardTitle>
                    <CardDescription>
                      Highest value{" "}
                      {reportType === "location"
                        ? "locations"
                        : reportType === "sublocation"
                        ? "sub-locations"
                        : "departments"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={analyticsData.sortedByValue.slice(0, 10)}
                        layout="vertical"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis type="number" stroke="hsl(var(--foreground))" />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={100}
                          tick={{ fontSize: 11 }}
                          stroke="hsl(var(--foreground))"
                          tickFormatter={(value) =>
                            value.length > 12 ? value.substring(0, 12) + "..." : value
                          }
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            `Rs. ${value.toLocaleString()}`,
                            "Value",
                          ]}
                        />
                        <Bar dataKey="totalValue" fill="hsl(142, 76%, 36%)" name="Value" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Breakdown</CardTitle>
                  <CardDescription>
                    Complete{" "}
                    {reportType === "location"
                      ? "location"
                      : reportType === "sublocation"
                      ? "sub-location"
                      : "department"}{" "}
                    data with status and condition metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          {(reportType === "sublocation" ||
                            reportType === "department") && (
                            <TableHead>Parent</TableHead>
                          )}
                          <TableHead>
                            {reportType === "location"
                              ? "Location"
                              : reportType === "sublocation"
                              ? "Sub-Location"
                              : "Department"}
                          </TableHead>
                          <TableHead className="text-right">Assets</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead className="text-right">Active</TableHead>
                          <TableHead className="text-right">Utilization</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyticsData.sortedByCount.map((item) => (
                          <Collapsible
                            key={item.id}
                            open={expandedRows.has(item.id)}
                            onOpenChange={() => toggleRow(item.id)}
                            asChild
                          >
                            <>
                              <TableRow className="cursor-pointer hover:bg-muted/50">
                                <TableCell>
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                                      {expandedRows.has(item.id) ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </CollapsibleTrigger>
                                </TableCell>
                                {(reportType === "sublocation" ||
                                  reportType === "department") && (
                                  <TableCell className="text-muted-foreground">
                                    {item.parentName || "—"}
                                  </TableCell>
                                )}
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-right">{item.assetCount}</TableCell>
                                <TableCell className="text-right">
                                  Rs. {item.totalValue.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge
                                    variant={item.activeCount > 0 ? "default" : "secondary"}
                                  >
                                    {item.activeCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge
                                    variant={
                                      item.utilizationRate > 70
                                        ? "default"
                                        : item.utilizationRate > 40
                                        ? "secondary"
                                        : "destructive"
                                    }
                                  >
                                    {item.utilizationRate.toFixed(0)}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                              <CollapsibleContent asChild>
                                <TableRow className="bg-muted/30">
                                  <TableCell
                                    colSpan={
                                      reportType === "location" ? 7 : 8
                                    }
                                    className="p-4"
                                  >
                                    {/* Capture container with ref */}
                                    <div 
                                      ref={(el) => { detailRefs.current[item.id] = el; }}
                                      className="space-y-6 bg-background p-4 rounded-lg"
                                    >
                                      {/* Header with report type, parent info, and download buttons */}
                                      <div className="flex items-center justify-between border-b pb-3">
                                        <div>
                                          <Badge variant="outline" className="mb-2">
                                            {reportType === "location" 
                                              ? "Location Report" 
                                              : reportType === "sublocation" 
                                              ? "Sub-Location Report" 
                                              : "Department Report"}
                                          </Badge>
                                          {item.parentName && (
                                            <p className="text-sm text-muted-foreground">
                                              Parent: {item.parentName}
                                            </p>
                                          )}
                                          <h3 className="text-lg font-semibold">{item.name}</h3>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleCaptureAsJpg(item.id, item.name)}
                                            disabled={isCapturing === item.id || isCapturingPdf === item.id}
                                            className="gap-2"
                                          >
                                            <Camera className="h-4 w-4" />
                                            {isCapturing === item.id ? "Capturing..." : "JPG"}
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleCaptureAsPdf(item.id, item.name)}
                                            disabled={isCapturing === item.id || isCapturingPdf === item.id}
                                            className="gap-2"
                                          >
                                            <FileText className="h-4 w-4" />
                                            {isCapturingPdf === item.id ? "Generating..." : "PDF"}
                                          </Button>
                                        </div>
                                      </div>
                                      
                                      {/* Summary KPIs row */}
                                      <div className="grid grid-cols-4 gap-4 bg-muted/30 p-3 rounded-lg">
                                        <div className="text-center">
                                          <p className="text-xs text-muted-foreground">Assets</p>
                                          <p className="text-xl font-bold">{item.assetCount}</p>
                                        </div>
                                        <div className="text-center">
                                          <p className="text-xs text-muted-foreground">Total Value</p>
                                          <p className="text-xl font-bold">Rs. {item.totalValue.toLocaleString()}</p>
                                        </div>
                                        <div className="text-center">
                                          <p className="text-xs text-muted-foreground">Active</p>
                                          <Badge variant="default" className="text-lg px-3 py-1">{item.activeCount}</Badge>
                                        </div>
                                        <div className="text-center">
                                          <p className="text-xs text-muted-foreground">Utilization</p>
                                          <Badge 
                                            variant={item.utilizationRate > 70 ? "default" : item.utilizationRate > 40 ? "secondary" : "destructive"}
                                            className="text-lg px-3 py-1"
                                          >
                                            {item.utilizationRate.toFixed(0)}%
                                          </Badge>
                                        </div>
                                      </div>
                                      
                                      {/* Row 1: Status, Condition, Value, Performance */}
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-1">
                                            Status Breakdown
                                          </p>
                                          <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                              <span className="text-success">Active:</span>
                                              <span>{item.activeCount}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-warning">Maintenance:</span>
                                              <span>{item.maintenanceCount}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-destructive">Inactive:</span>
                                              <span>{item.inactiveCount}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">
                                                Disposed:
                                              </span>
                                              <span>{item.disposedCount}</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-1">
                                            Condition Breakdown
                                          </p>
                                          <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                              <span className="text-success">Good:</span>
                                              <span>{item.goodCondition}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-warning">Fair:</span>
                                              <span>{item.fairCondition}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-destructive">Poor:</span>
                                              <span>{item.poorCondition}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-destructive">
                                                Needs Repair:
                                              </span>
                                              <span>{item.needsRepairCondition}</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-1">
                                            Value Metrics
                                          </p>
                                          <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                              <span>Total Value:</span>
                                              <span>Rs. {item.totalValue.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>Avg Value:</span>
                                              <span>
                                                Rs.{" "}
                                                {item.assetCount > 0
                                                  ? Math.round(
                                                      item.totalValue / item.assetCount
                                                    ).toLocaleString()
                                                  : 0}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-1">
                                            Performance
                                          </p>
                                          <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                              <span>Utilization:</span>
                                              <span>{item.utilizationRate.toFixed(1)}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>Good Condition:</span>
                                              <span>
                                                {item.assetCount > 0
                                                  ? (
                                                      (item.goodCondition / item.assetCount) *
                                                      100
                                                    ).toFixed(0)
                                                  : 0}
                                                %
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Row 2: Main Category Breakdown */}
                                      {item.categoryBreakdown.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                            <Layers className="h-3 w-3" />
                                            Main Category Breakdown
                                          </p>
                                          <div className="flex flex-wrap gap-2">
                                            {item.categoryBreakdown.slice(0, 8).map((cat) => (
                                              <Badge
                                                key={cat.categoryId}
                                                variant="secondary"
                                                className="text-xs"
                                              >
                                                {cat.categoryName}: {cat.assetCount}
                                              </Badge>
                                            ))}
                                            {item.categoryBreakdown.length > 8 && (
                                              <Badge variant="outline" className="text-xs">
                                                +{item.categoryBreakdown.length - 8} more
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Row 3: Subcategory Analysis Table */}
                                      {item.subcategoryBreakdown.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-2">
                                            Subcategory Analysis
                                          </p>
                                          <div className="border rounded-lg overflow-hidden">
                                            <Table>
                                              <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                  <TableHead className="text-xs py-2">Subcategory</TableHead>
                                                  <TableHead className="text-xs py-2">Category</TableHead>
                                                  <TableHead className="text-xs py-2 text-right">Assets</TableHead>
                                                  <TableHead className="text-xs py-2 text-right">Value</TableHead>
                                                  <TableHead className="text-xs py-2 text-right text-success">Good</TableHead>
                                                  <TableHead className="text-xs py-2 text-right text-warning">Fair</TableHead>
                                                  <TableHead className="text-xs py-2 text-right text-destructive">Poor</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {item.subcategoryBreakdown.slice(0, 8).map((sub) => (
                                                  <TableRow key={sub.subcategoryId} className="text-xs">
                                                    <TableCell className="py-1.5 font-medium">
                                                      {sub.subcategoryName}
                                                    </TableCell>
                                                    <TableCell className="py-1.5 text-muted-foreground">
                                                      {sub.parentCategoryName}
                                                    </TableCell>
                                                    <TableCell className="py-1.5 text-right">
                                                      {sub.assetCount}
                                                    </TableCell>
                                                    <TableCell className="py-1.5 text-right">
                                                      Rs. {sub.totalValue.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="py-1.5 text-right text-success">
                                                      {sub.goodCondition}
                                                    </TableCell>
                                                    <TableCell className="py-1.5 text-right text-warning">
                                                      {sub.fairCondition}
                                                    </TableCell>
                                                    <TableCell className="py-1.5 text-right text-destructive">
                                                      {sub.poorCondition + sub.needsRepair}
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                            {item.subcategoryBreakdown.length > 8 && (
                                              <div className="text-xs text-muted-foreground text-center py-2 border-t">
                                                +{item.subcategoryBreakdown.length - 8} more subcategories
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Row 4: Subcategory Charts */}
                                      {item.subcategoryBreakdown.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {/* Subcategories by Asset Count */}
                                          <div className="border rounded-lg p-3">
                                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                              Subcategories by Asset Count
                                            </p>
                                            <ResponsiveContainer width="100%" height={180}>
                                              <BarChart data={item.subcategoryBreakdown.slice(0, 6)}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                                <XAxis
                                                  dataKey="subcategoryName"
                                                  tick={{ fontSize: 9 }}
                                                  angle={-45}
                                                  textAnchor="end"
                                                  height={60}
                                                  stroke="hsl(var(--foreground))"
                                                  tickFormatter={(v) => v.length > 10 ? v.substring(0, 10) + "..." : v}
                                                />
                                                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--foreground))" />
                                                <Tooltip
                                                  formatter={(value: number) => [value, "Assets"]}
                                                  contentStyle={{ fontSize: 11 }}
                                                />
                                                <Bar dataKey="assetCount" fill="hsl(217, 91%, 60%)" name="Assets" />
                                              </BarChart>
                                            </ResponsiveContainer>
                                          </div>

                                          {/* Condition Distribution by Subcategory */}
                                          <div className="border rounded-lg p-3">
                                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                              Condition Distribution by Subcategory
                                            </p>
                                            <ResponsiveContainer width="100%" height={180}>
                                              <BarChart data={item.subcategoryBreakdown.slice(0, 6)}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                                <XAxis
                                                  dataKey="subcategoryName"
                                                  tick={{ fontSize: 9 }}
                                                  angle={-45}
                                                  textAnchor="end"
                                                  height={60}
                                                  stroke="hsl(var(--foreground))"
                                                  tickFormatter={(v) => v.length > 10 ? v.substring(0, 10) + "..." : v}
                                                />
                                                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--foreground))" />
                                                <Tooltip contentStyle={{ fontSize: 11 }} />
                                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                                <Bar dataKey="goodCondition" stackId="a" fill={CONDITION_COLORS.good} name="Good" />
                                                <Bar dataKey="fairCondition" stackId="a" fill={CONDITION_COLORS.fair} name="Fair" />
                                                <Bar dataKey="poorCondition" stackId="a" fill={CONDITION_COLORS.poor} name="Poor" />
                                                <Bar dataKey="needsRepair" stackId="a" fill={CONDITION_COLORS.needsRepair} name="Repair" />
                                              </BarChart>
                                            </ResponsiveContainer>
                                          </div>
                                        </div>
                                      )}

                                      {/* Row 5: Asset Master Items Detail */}
                                      {item.assetMasterBreakdown && item.assetMasterBreakdown.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                            <Package className="h-3 w-3" />
                                            Asset Master Items Detail
                                          </p>
                                          <div className="border rounded-lg overflow-hidden">
                                            <Table>
                                              <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                  <TableHead className="text-xs py-2">Item Name</TableHead>
                                                  <TableHead className="text-xs py-2">Brand</TableHead>
                                                  <TableHead className="text-xs py-2">Category</TableHead>
                                                  <TableHead className="text-xs py-2">Subcategory</TableHead>
                                                  <TableHead className="text-xs py-2 text-right">Count</TableHead>
                                                  <TableHead className="text-xs py-2 text-right">Value</TableHead>
                                                  <TableHead className="text-xs py-2 text-right text-success">Good</TableHead>
                                                  <TableHead className="text-xs py-2 text-right text-warning">Fair</TableHead>
                                                  <TableHead className="text-xs py-2 text-right text-destructive">Poor</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {item.assetMasterBreakdown.map((am) => (
                                                  <TableRow key={am.assetMasterId} className="text-xs">
                                                    <TableCell className="py-1.5 font-medium">{am.assetMasterName}</TableCell>
                                                    <TableCell className="py-1.5 text-muted-foreground">{am.brand || "—"}</TableCell>
                                                    <TableCell className="py-1.5 text-muted-foreground">{am.categoryName || "—"}</TableCell>
                                                    <TableCell className="py-1.5 text-muted-foreground">{am.subcategoryName || "—"}</TableCell>
                                                    <TableCell className="py-1.5 text-right">{am.assetCount}</TableCell>
                                                    <TableCell className="py-1.5 text-right">Rs. {am.totalValue.toLocaleString()}</TableCell>
                                                    <TableCell className="py-1.5 text-right text-success">{am.goodCondition}</TableCell>
                                                    <TableCell className="py-1.5 text-right text-warning">{am.fairCondition}</TableCell>
                                                    <TableCell className="py-1.5 text-right text-destructive">{am.poorCondition + am.needsRepair}</TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        </div>
                                      )}

                                      {/* No subcategory data message */}
                                      {item.subcategoryBreakdown.length === 0 && (!item.assetMasterBreakdown || item.assetMasterBreakdown.length === 0) && (
                                        <div className="text-xs text-muted-foreground text-center py-2">
                                          No detailed breakdown data available for this location
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </CollapsibleContent>
                            </>
                          </Collapsible>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
