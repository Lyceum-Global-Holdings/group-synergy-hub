import { useMemo, useState } from "react";
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
} from "lucide-react";
import { WarehouseAsset, WarehouseLocation, AssetCategory } from "@/types/warehouse";
import { toast } from "@/hooks/use-toast";
import { writeExcelFromJSON } from "@/utils/excelUtils";

interface LocationReportAnalyticsProps {
  assets: WarehouseAsset[];
  locations: WarehouseLocation[];
  categories: AssetCategory[];
}

interface LocationAnalyticsData {
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
  const [reportType, setReportType] = useState<ReportType>("location");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedSublocation, setSelectedSublocation] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

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

  // Get main categories (no parent_id) and filtered subcategories
  const mainCategories = useMemo(
    () => categories.filter((cat) => !cat.parent_id),
    [categories]
  );

  const filteredSubcategories = useMemo(() => {
    if (selectedCategory === "all") {
      return categories.filter((cat) => cat.parent_id);
    }
    return categories.filter((cat) => cat.parent_id === selectedCategory);
  }, [categories, selectedCategory]);

  // Filter assets based on selected filters
  const filteredAssets = useMemo(() => {
    let result = [...assets];

    if (selectedLocation !== "all") {
      result = result.filter((a) => a.location_id === selectedLocation);
    }

    if (selectedSublocation !== "all") {
      result = result.filter((a) => a.sublocation_id === selectedSublocation);
    }

    if (selectedCategory !== "all") {
      result = result.filter((a) => a.category_id === selectedCategory);
    }

    if (selectedSubcategory !== "all") {
      result = result.filter((a) => a.subcategory_id === selectedSubcategory);
    }

    if (selectedStatus !== "all") {
      result = result.filter((a) => a.status === selectedStatus);
    }

    return result;
  }, [assets, selectedLocation, selectedSublocation, selectedCategory, selectedSubcategory, selectedStatus]);

  // Calculate analytics data based on report type
  const analyticsData = useMemo(() => {
    const getGroupingKey = (asset: WarehouseAsset): string | null => {
      switch (reportType) {
        case "location":
          return asset.location_id || null;
        case "sublocation":
          return asset.sublocation_id || null;
        case "department":
          return asset.department_id || null;
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

    // Group assets
    const groupedData: Record<string, LocationAnalyticsData> = {};

    // Initialize all locations with zero counts
    groupingLocations.forEach((loc) => {
      const parentLoc = locations.find((l) => l.id === loc.parent_id);
      groupedData[loc.id] = {
        id: loc.id,
        name: loc.name,
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
      };
    });

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

    // Pie chart data - Value distribution
    const valueDistribution = sortedByValue.slice(0, 8).map((loc, index) => ({
      name: loc.name,
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
  ]);

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

  // Reset dependent filters when parent filter changes
  const handleLocationChange = (value: string) => {
    setSelectedLocation(value);
    setSelectedSublocation("all");
  };

  const handleSublocationChange = (value: string) => {
    setSelectedSublocation(value);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setSelectedSubcategory("all"); // Reset subcategory when category changes
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
        <Button onClick={handleExport} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting..." : "Export to Excel"}
        </Button>
      </div>

      {/* Report Type Tabs */}
      <Tabs
        value={reportType}
        onValueChange={(value) => setReportType(value as ReportType)}
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

          {reportType === "department" && (
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

          {/* Category Filter */}
          <div className="w-48">
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
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

          {/* Sub-Category Filter */}
          <div className="w-48">
            <Select
              value={selectedSubcategory}
              onValueChange={setSelectedSubcategory}
              disabled={selectedCategory === "all"}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Sub-Categories" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="all">All Sub-Categories</SelectItem>
                {filteredSubcategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
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
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analyticsData.sortedByCount.slice(0, 10)}>
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
                          tickFormatter={(value) =>
                            value.length > 12 ? value.substring(0, 12) + "..." : value
                          }
                        />
                        <YAxis stroke="hsl(var(--foreground))" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                          dataKey="assetCount"
                          fill="hsl(217, 91%, 60%)"
                          name="Assets"
                        />
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
