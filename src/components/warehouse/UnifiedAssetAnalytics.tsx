import { useState, useMemo } from "react";
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
import {
  BarChart3,
  Layers,
  MapPin,
  FileSpreadsheet,
  Download,
  Package,
  DollarSign,
  TrendingUp,
  Target,
  Loader2,
} from "lucide-react";
import { WarehouseAsset, WarehouseLocation, AssetCategory } from "@/types/warehouse";
import { AssetAnalytics } from "./AssetAnalytics";
import { SubcategoryAnalytics } from "./SubcategoryAnalytics";
import { LocationReportAnalytics } from "./LocationReportAnalytics";
import { toast } from "@/hooks/use-toast";
import { writeExcelFromJSON } from "@/utils/excelUtils";

interface UnifiedAssetAnalyticsProps {
  assets: WarehouseAsset[];
  locations: WarehouseLocation[];
  categories: AssetCategory[];
  totalCount?: number;
  activeCount?: number;
  maintenanceCount?: number;
}

type ReportType = "location" | "sublocation" | "department" | "category" | "subcategory";

interface ReportConfig {
  label: string;
  description: string;
}

const REPORT_CONFIGS: Record<ReportType, ReportConfig> = {
  location: {
    label: "Location-wise",
    description: "Asset distribution by main locations",
  },
  sublocation: {
    label: "Sub-Location-wise",
    description: "Asset distribution by sub-locations",
  },
  department: {
    label: "Department-wise",
    description: "Asset distribution by departments",
  },
  category: {
    label: "Category-wise",
    description: "Asset distribution by main categories",
  },
  subcategory: {
    label: "Subcategory-wise",
    description: "Asset distribution by subcategories",
  },
};

export function UnifiedAssetAnalytics({
  assets,
  locations,
  categories,
  totalCount,
  activeCount,
  maintenanceCount,
}: UnifiedAssetAnalyticsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [reportType, setReportType] = useState<ReportType>("location");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Filter data
  const mainLocations = useMemo(
    () => locations.filter((loc) => loc.type === "location"),
    [locations]
  );

  const mainCategories = useMemo(
    () => categories.filter((cat) => !cat.parent_id),
    [categories]
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
    return locations.filter((loc) => loc.type === "department");
  }, [locations]);

  const subcategories = useMemo(() => {
    if (selectedCategory === "all") {
      return categories.filter((cat) => cat.parent_id);
    }
    return categories.filter((cat) => cat.parent_id === selectedCategory);
  }, [categories, selectedCategory]);

  // Apply filters
  const filteredAssets = useMemo(() => {
    let result = [...assets];

    if (selectedLocation !== "all") {
      result = result.filter((a) => a.location_id === selectedLocation);
    }

    if (selectedCategory !== "all") {
      result = result.filter(
        (a) => a.category_id === selectedCategory || a.subcategory_id === selectedCategory
      );
    }

    if (selectedStatus !== "all") {
      result = result.filter((a) => a.status === selectedStatus);
    }

    return result;
  }, [assets, selectedLocation, selectedCategory, selectedStatus]);

  // Generate report data based on report type
  const reportData = useMemo(() => {
    const getGroupingData = () => {
      switch (reportType) {
        case "location":
          return mainLocations.map((loc) => ({
            id: loc.id,
            name: loc.name,
            parentName: null,
          }));
        case "sublocation":
          return sublocations.map((loc) => {
            const parent = locations.find((l) => l.id === loc.parent_id);
            return {
              id: loc.id,
              name: loc.name,
              parentName: parent?.name || "—",
            };
          });
        case "department":
          return departments.map((loc) => {
            const parent = locations.find((l) => l.id === loc.parent_id);
            const grandparent = parent
              ? locations.find((l) => l.id === parent.parent_id)
              : null;
            return {
              id: loc.id,
              name: loc.name,
              parentName: parent ? `${grandparent?.name || ""} > ${parent.name}` : "—",
            };
          });
        case "category":
          return mainCategories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            parentName: null,
          }));
        case "subcategory":
          return subcategories.map((cat) => {
            const parent = categories.find((c) => c.id === cat.parent_id);
            return {
              id: cat.id,
              name: cat.name,
              parentName: parent?.name || "—",
            };
          });
        default:
          return [];
      }
    };

    const getGroupKey = (asset: WarehouseAsset): string | null => {
      switch (reportType) {
        case "location":
          return asset.location_id || null;
        case "sublocation":
          return asset.sublocation_id || null;
        case "department":
          return asset.department_id || null;
        case "category":
          return asset.category_id || null;
        case "subcategory":
          return asset.subcategory_id || null;
        default:
          return null;
      }
    };

    const groupingData = getGroupingData();
    const groupedResults: Record<
      string,
      {
        id: string;
        name: string;
        parentName: string | null;
        assetCount: number;
        totalValue: number;
        activeCount: number;
        maintenanceCount: number;
        inactiveCount: number;
        goodCondition: number;
        fairCondition: number;
        poorCondition: number;
      }
    > = {};

    // Initialize all groups
    groupingData.forEach((item) => {
      groupedResults[item.id] = {
        id: item.id,
        name: item.name,
        parentName: item.parentName,
        assetCount: 0,
        totalValue: 0,
        activeCount: 0,
        maintenanceCount: 0,
        inactiveCount: 0,
        goodCondition: 0,
        fairCondition: 0,
        poorCondition: 0,
      };
    });

    // Aggregate data
    filteredAssets.forEach((asset) => {
      const key = getGroupKey(asset);
      if (key && groupedResults[key]) {
        const data = groupedResults[key];
        data.assetCount++;
        data.totalValue += asset.current_value || asset.purchase_price || 0;

        if (asset.status === "active") data.activeCount++;
        else if (asset.status === "maintenance") data.maintenanceCount++;
        else if (asset.status === "inactive") data.inactiveCount++;

        if (asset.condition === "good") data.goodCondition++;
        else if (asset.condition === "fair") data.fairCondition++;
        else if (asset.condition === "poor") data.poorCondition++;
      }
    });

    return Object.values(groupedResults)
      .filter((r) => r.assetCount > 0)
      .sort((a, b) => b.assetCount - a.assetCount);
  }, [
    reportType,
    filteredAssets,
    mainLocations,
    sublocations,
    departments,
    mainCategories,
    subcategories,
    locations,
    categories,
  ]);

  // Export handler
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const config = REPORT_CONFIGS[reportType];
      const includeParent = reportType !== "location" && reportType !== "category";

      const exportData = reportData.map((item) => {
        const baseData: Record<string, string | number> = {};

        if (includeParent) {
          baseData["Parent"] = item.parentName || "—";
        }

        baseData[config.label.replace("-wise", "")] = item.name;
        baseData["Total Assets"] = item.assetCount;
        baseData["Total Value (Rs.)"] = item.totalValue;
        baseData["Active"] = item.activeCount;
        baseData["Maintenance"] = item.maintenanceCount;
        baseData["Inactive"] = item.inactiveCount;
        baseData["Good Condition"] = item.goodCondition;
        baseData["Fair Condition"] = item.fairCondition;
        baseData["Poor Condition"] = item.poorCondition;

        return baseData;
      });

      const fileName = `Asset_${config.label.replace("-wise", "")}_Report_${
        new Date().toISOString().split("T")[0]
      }`;
      await writeExcelFromJSON(exportData, fileName, `${config.label} Report`);

      toast({
        title: "Export Successful",
        description: `${config.label} report exported to Excel`,
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

  // Calculate KPIs
  const kpis = useMemo(() => {
    const total = totalCount ?? assets.length;
    const active = activeCount ?? assets.filter((a) => a.status === "active").length;
    const maintenance =
      maintenanceCount ?? assets.filter((a) => a.status === "maintenance").length;
    const totalValue = assets.reduce(
      (sum, a) => sum + (a.current_value || a.purchase_price || 0),
      0
    );
    const utilizationRate = total > 0 ? (active / total) * 100 : 0;

    return {
      total,
      active,
      maintenance,
      totalValue,
      utilizationRate,
    };
  }, [assets, totalCount, activeCount, maintenanceCount]);

  const handlePreview = () => {
    setShowPreview(true);
  };

  const resetFilters = () => {
    setSelectedLocation("all");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setShowPreview(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Analytics & Reports</h2>
          <p className="text-sm text-muted-foreground">
            Comprehensive asset analytics and custom report generation
          </p>
        </div>
      </div>

      {/* Internal Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="subcategory" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Subcategory
          </TabsTrigger>
          <TabsTrigger value="location" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Generate Reports
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab - Uses existing AssetAnalytics */}
        <TabsContent value="overview" className="mt-6">
          <AssetAnalytics
            assets={assets}
            locations={locations}
            categories={categories}
            totalCount={totalCount}
            activeCount={activeCount}
            maintenanceCount={maintenanceCount}
          />
        </TabsContent>

        {/* Subcategory Tab - Uses existing SubcategoryAnalytics */}
        <TabsContent value="subcategory" className="mt-6">
          <SubcategoryAnalytics assets={assets} categories={categories} />
        </TabsContent>

        {/* Location Tab - Uses existing LocationReportAnalytics */}
        <TabsContent value="location" className="mt-6">
          <LocationReportAnalytics
            assets={assets}
            locations={locations}
            categories={categories}
          />
        </TabsContent>

        {/* Generate Reports Tab - New dedicated report generation */}
        <TabsContent value="reports" className="mt-6">
          <div className="space-y-6">
            {/* KPI Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.total.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{kpis.active} active</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Utilization Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.utilizationRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">Active vs total</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    Rs. {kpis.totalValue.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Current value</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Report Items</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {REPORT_CONFIGS[reportType].label}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Report Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Report Configuration</CardTitle>
                <CardDescription>
                  Select report type and apply filters to generate custom reports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Report Type Selection */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Report Type</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(REPORT_CONFIGS) as ReportType[]).map((type) => (
                      <Button
                        key={type}
                        variant={reportType === type ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setReportType(type);
                          setShowPreview(false);
                        }}
                      >
                        {REPORT_CONFIGS[type].label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {REPORT_CONFIGS[reportType].description}
                  </p>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Location</label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
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

                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md z-50">
                        <SelectItem value="all">All Categories</SelectItem>
                        {mainCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
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

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button variant="outline" onClick={resetFilters}>
                    Reset Filters
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handlePreview}>
                      Preview Report
                    </Button>
                    <Button onClick={handleExport} disabled={isExporting || reportData.length === 0}>
                      {isExporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Export to Excel
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview Table */}
            {showPreview && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Report Preview</CardTitle>
                      <CardDescription>
                        {REPORT_CONFIGS[reportType].label} - {reportData.length} items
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      Filtered: {filteredAssets.length} assets
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {reportData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No data available for the selected filters
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {(reportType === "sublocation" ||
                              reportType === "department" ||
                              reportType === "subcategory") && (
                              <TableHead>Parent</TableHead>
                            )}
                            <TableHead>
                              {REPORT_CONFIGS[reportType].label.replace("-wise", "")}
                            </TableHead>
                            <TableHead className="text-right">Assets</TableHead>
                            <TableHead className="text-right">Value (Rs.)</TableHead>
                            <TableHead className="text-right">Active</TableHead>
                            <TableHead className="text-right">Maintenance</TableHead>
                            <TableHead className="text-right">Good</TableHead>
                            <TableHead className="text-right">Fair</TableHead>
                            <TableHead className="text-right">Poor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.slice(0, 20).map((item) => (
                            <TableRow key={item.id}>
                              {(reportType === "sublocation" ||
                                reportType === "department" ||
                                reportType === "subcategory") && (
                                <TableCell className="text-muted-foreground">
                                  {item.parentName || "—"}
                                </TableCell>
                              )}
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-right">{item.assetCount}</TableCell>
                              <TableCell className="text-right">
                                {item.totalValue.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-success">
                                {item.activeCount}
                              </TableCell>
                              <TableCell className="text-right text-warning">
                                {item.maintenanceCount}
                              </TableCell>
                              <TableCell className="text-right">{item.goodCondition}</TableCell>
                              <TableCell className="text-right">{item.fairCondition}</TableCell>
                              <TableCell className="text-right">{item.poorCondition}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {reportData.length > 20 && (
                        <div className="p-3 text-center text-sm text-muted-foreground border-t">
                          Showing 20 of {reportData.length} items. Export to see all data.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
