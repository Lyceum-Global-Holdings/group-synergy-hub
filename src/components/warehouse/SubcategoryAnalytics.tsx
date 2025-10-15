import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { 
  Layers, 
  TrendingUp, 
  Package, 
  DollarSign,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import { WarehouseAsset, AssetCategory } from "@/types/warehouse";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface SubcategoryAnalyticsProps {
  assets: WarehouseAsset[];
  categories: AssetCategory[];
}

interface SubcategoryData {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string;
  count: number;
  totalValue: number;
  purchaseValue: number;
  activeCount: number;
  maintenanceCount: number;
  inactiveCount: number;
  disposedCount: number;
  goodCondition: number;
  fairCondition: number;
  poorCondition: number;
  needsRepairCondition: number;
  avgValue: number;
  activePercentage: number;
  goodConditionPercentage: number;
  depreciation: number;
  depreciationRate: number;
}

const COLORS = [
  'hsl(217, 91%, 60%)', // Primary
  'hsl(199, 89%, 48%)', // Info  
  'hsl(142, 76%, 36%)', // Success
  'hsl(38, 92%, 50%)', // Warning
  'hsl(0, 84%, 60%)', // Destructive
  'hsl(280, 85%, 60%)', // Purple
  'hsl(340, 82%, 52%)', // Pink
  'hsl(24, 95%, 53%)', // Orange
];

export function SubcategoryAnalytics({ assets, categories }: SubcategoryAnalyticsProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<keyof SubcategoryData>('count');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const analyticsData = useMemo(() => {
    // Filter assets with subcategory
    const assetsWithSubcategory = assets.filter(a => a.subcategory_id);
    
    if (assetsWithSubcategory.length === 0) {
      return null;
    }

    // Group by subcategory
    const subcategoryMap = assetsWithSubcategory.reduce((acc, asset) => {
      const subId = asset.subcategory_id!;
      if (!acc[subId]) {
        const subcategory = categories.find(c => c.id === subId);
        const parentCategory = categories.find(c => c.id === subcategory?.parent_id);
        acc[subId] = {
          id: subId,
          name: subcategory?.name || 'Unknown',
          parentId: subcategory?.parent_id || null,
          parentName: parentCategory?.name || 'Unknown',
          count: 0,
          totalValue: 0,
          purchaseValue: 0,
          activeCount: 0,
          maintenanceCount: 0,
          inactiveCount: 0,
          disposedCount: 0,
          goodCondition: 0,
          fairCondition: 0,
          poorCondition: 0,
          needsRepairCondition: 0,
          avgValue: 0,
          activePercentage: 0,
          goodConditionPercentage: 0,
          depreciation: 0,
          depreciationRate: 0,
        };
      }
      
      acc[subId].count++;
      acc[subId].totalValue += (asset.current_value || asset.purchase_price || 0);
      acc[subId].purchaseValue += (asset.purchase_price || 0);
      
      // Status counts
      if (asset.status === 'active') acc[subId].activeCount++;
      if (asset.status === 'maintenance') acc[subId].maintenanceCount++;
      if (asset.status === 'inactive') acc[subId].inactiveCount++;
      if (asset.status === 'disposed') acc[subId].disposedCount++;
      
      // Condition counts
      if (asset.condition === 'good') acc[subId].goodCondition++;
      if (asset.condition === 'fair') acc[subId].fairCondition++;
      if (asset.condition === 'poor') acc[subId].poorCondition++;
      if (asset.condition === 'needs_repair') acc[subId].needsRepairCondition++;
      
      return acc;
    }, {} as Record<string, SubcategoryData>);
    
    // Calculate percentages and derived metrics
    const subcategoryData = Object.values(subcategoryMap).map(sub => ({
      ...sub,
      avgValue: sub.count > 0 ? sub.totalValue / sub.count : 0,
      activePercentage: sub.count > 0 ? (sub.activeCount / sub.count) * 100 : 0,
      goodConditionPercentage: sub.count > 0 ? (sub.goodCondition / sub.count) * 100 : 0,
      depreciation: sub.purchaseValue - sub.totalValue,
      depreciationRate: sub.purchaseValue > 0 ? ((sub.purchaseValue - sub.totalValue) / sub.purchaseValue) * 100 : 0,
    }));
    
    // Sort data
    const byCount = [...subcategoryData].sort((a, b) => b.count - a.count);
    const byValue = [...subcategoryData].sort((a, b) => b.totalValue - a.totalValue);
    
    // KPIs
    const totalSubcategories = subcategoryData.length;
    const mostValuable = byValue[0] || null;
    const mostPopulated = byCount[0] || null;
    const avgAssetsPerSubcategory = totalSubcategories > 0 ? assetsWithSubcategory.length / totalSubcategories : 0;
    
    // Group by parent category for hierarchical view
    const byParentCategory = subcategoryData.reduce((acc, sub) => {
      const parentId = sub.parentId || 'uncategorized';
      if (!acc[parentId]) {
        acc[parentId] = {
          parentName: sub.parentName,
          subcategories: [],
          totalAssets: 0,
          totalValue: 0,
        };
      }
      acc[parentId].subcategories.push(sub);
      acc[parentId].totalAssets += sub.count;
      acc[parentId].totalValue += sub.totalValue;
      return acc;
    }, {} as Record<string, { parentName: string; subcategories: SubcategoryData[]; totalAssets: number; totalValue: number }>);
    
    // Top subcategories for charts (limit to 15)
    const topByCount = byCount.slice(0, 15);
    const topByValue = byValue.slice(0, 10);
    
    return {
      subcategoryData,
      byCount,
      byValue,
      byParentCategory,
      topByCount,
      topByValue,
      kpis: {
        totalSubcategories,
        mostValuable,
        mostPopulated,
        avgAssetsPerSubcategory,
      },
    };
  }, [assets, categories]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleSort = (field: keyof SubcategoryData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = useMemo(() => {
    if (!analyticsData) return [];
    const sorted = [...analyticsData.subcategoryData].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });
    return sorted;
  }, [analyticsData, sortField, sortDirection]);

  if (!analyticsData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No Subcategory Data Available</p>
          <p className="text-sm text-muted-foreground mt-2">
            Assets need to be assigned to subcategories to view analytics
          </p>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-3 rounded shadow-md">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey}: ${
                entry.dataKey.includes('value') || entry.dataKey.includes('Value')
                  ? `Rs. ${entry.value.toLocaleString()}`
                  : entry.value
              }`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subcategories</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.kpis.totalSubcategories}</div>
            <p className="text-xs text-muted-foreground">
              Active classifications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Valuable</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {analyticsData.kpis.mostValuable?.name || '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              Rs. {analyticsData.kpis.mostValuable?.totalValue.toLocaleString() || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Populated</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {analyticsData.kpis.mostPopulated?.name || '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {analyticsData.kpis.mostPopulated?.count || 0} assets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Assets/Subcategory</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.kpis.avgAssetsPerSubcategory.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Distribution rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Hierarchical View by Parent Category */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Subcategories by Parent Category
          </CardTitle>
          <CardDescription>
            Hierarchical breakdown with status and condition metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(analyticsData.byParentCategory).map(([parentId, data]) => (
            <Collapsible
              key={parentId}
              open={expandedCategories.has(parentId)}
              onOpenChange={() => toggleCategory(parentId)}
            >
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-4 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {expandedCategories.has(parentId) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-semibold">{data.parentName}</span>
                      <Badge variant="secondary">
                        {data.subcategories.length} subcategories
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {data.totalAssets} assets
                      </span>
                      <span className="font-medium">
                        Rs. {data.totalValue.toLocaleString()}
                      </span>
                    </div>
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="border-t divide-y">
                    {data.subcategories.map((sub) => (
                      <div key={sub.id} className="p-4 hover:bg-muted/30">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-medium">{sub.name}</h4>
                            <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                              <span>{sub.count} assets</span>
                              <span>Rs. {sub.totalValue.toLocaleString()}</span>
                              <span>Avg: Rs. {sub.avgValue.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant={sub.activePercentage > 70 ? "default" : "secondary"}>
                              {sub.activePercentage.toFixed(0)}% Active
                            </Badge>
                            <Badge 
                              variant={
                                sub.goodConditionPercentage > 70 
                                  ? "default" 
                                  : sub.goodConditionPercentage > 40 
                                  ? "secondary" 
                                  : "destructive"
                              }
                            >
                              {sub.goodConditionPercentage.toFixed(0)}% Good
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* Status Distribution */}
                          <div>
                            <p className="text-xs font-medium mb-2">Status Distribution</p>
                            <div className="space-y-1">
                              {sub.activeCount > 0 && (
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={(sub.activeCount / sub.count) * 100} 
                                    className="h-2 flex-1"
                                  />
                                  <span className="text-xs text-success">{sub.activeCount}</span>
                                </div>
                              )}
                              {sub.maintenanceCount > 0 && (
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={(sub.maintenanceCount / sub.count) * 100} 
                                    className="h-2 flex-1 [&>div]:bg-warning"
                                  />
                                  <span className="text-xs text-warning">{sub.maintenanceCount}</span>
                                </div>
                              )}
                              {sub.inactiveCount > 0 && (
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={(sub.inactiveCount / sub.count) * 100} 
                                    className="h-2 flex-1 [&>div]:bg-destructive"
                                  />
                                  <span className="text-xs text-destructive">{sub.inactiveCount}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Condition Distribution */}
                          <div>
                            <p className="text-xs font-medium mb-2">Condition Distribution</p>
                            <div className="space-y-1">
                              {sub.goodCondition > 0 && (
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={(sub.goodCondition / sub.count) * 100} 
                                    className="h-2 flex-1"
                                  />
                                  <span className="text-xs text-success">{sub.goodCondition}</span>
                                </div>
                              )}
                              {sub.fairCondition > 0 && (
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={(sub.fairCondition / sub.count) * 100} 
                                    className="h-2 flex-1 [&>div]:bg-warning"
                                  />
                                  <span className="text-xs text-warning">{sub.fairCondition}</span>
                                </div>
                              )}
                              {(sub.poorCondition + sub.needsRepairCondition) > 0 && (
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={((sub.poorCondition + sub.needsRepairCondition) / sub.count) * 100} 
                                    className="h-2 flex-1 [&>div]:bg-destructive"
                                  />
                                  <span className="text-xs text-destructive">
                                    {sub.poorCondition + sub.needsRepairCondition}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Subcategories by Count */}
        <Card>
          <CardHeader>
            <CardTitle>Top 15 Subcategories by Asset Count</CardTitle>
            <CardDescription>
              Distribution of assets across subcategories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={analyticsData.topByCount}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  stroke="hsl(var(--foreground))"
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="count" fill="hsl(217, 91%, 60%)" name="Asset Count" />
                <Bar dataKey="totalValue" fill="hsl(142, 76%, 36%)" name="Total Value" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Subcategories by Value */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Subcategories by Value</CardTitle>
            <CardDescription>
              Current value vs purchase value comparison
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={analyticsData.topByValue}
                layout="vertical"
                margin={{ left: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--foreground))" />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--foreground))"
                  width={90}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="purchaseValue" fill="hsl(199, 89%, 48%)" name="Purchase Value" />
                <Bar dataKey="totalValue" fill="hsl(142, 76%, 36%)" name="Current Value" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subcategory Condition Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Condition Distribution by Subcategory</CardTitle>
            <CardDescription>
              Top 10 subcategories with condition breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={analyticsData.topByCount.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  stroke="hsl(var(--foreground))"
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="goodCondition" stackId="a" fill="hsl(142, 76%, 36%)" name="Good" />
                <Bar dataKey="fairCondition" stackId="a" fill="hsl(38, 92%, 50%)" name="Fair" />
                <Bar dataKey="poorCondition" stackId="a" fill="hsl(24, 95%, 53%)" name="Poor" />
                <Bar dataKey="needsRepairCondition" stackId="a" fill="hsl(0, 84%, 60%)" name="Needs Repair" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Depreciation Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Depreciation by Subcategory</CardTitle>
            <CardDescription>
              Top 10 subcategories with highest depreciation rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={[...analyticsData.byValue]
                  .sort((a, b) => b.depreciationRate - a.depreciationRate)
                  .slice(0, 10)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  stroke="hsl(var(--foreground))"
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const value = payload[0].value;
                      const depreciation = payload[0].payload.depreciation;
                      return (
                        <div className="bg-card border border-border p-3 rounded shadow-md">
                          <p className="font-medium">{label}</p>
                          <p style={{ color: payload[0].color }}>
                            Depreciation: Rs. {typeof depreciation === 'number' ? depreciation.toLocaleString() : depreciation}
                          </p>
                          <p style={{ color: payload[0].color }}>
                            Rate: {typeof value === 'number' ? value.toFixed(1) : value}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="depreciationRate" fill="hsl(0, 84%, 60%)" name="Depreciation Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Subcategory Analysis</CardTitle>
          <CardDescription>
            Complete breakdown with sortable columns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    Subcategory {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Parent Category</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('count')}
                  >
                    Count {sortField === 'count' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('totalValue')}
                  >
                    Total Value {sortField === 'totalValue' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('avgValue')}
                  >
                    Avg Value {sortField === 'avgValue' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('activePercentage')}
                  >
                    Active % {sortField === 'activePercentage' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('goodConditionPercentage')}
                  >
                    Good % {sortField === 'goodConditionPercentage' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('depreciationRate')}
                  >
                    Depr. Rate {sortField === 'depreciationRate' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((sub) => (
                  <TableRow key={sub.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{sub.name}</TableCell>
                    <TableCell className="text-muted-foreground">{sub.parentName}</TableCell>
                    <TableCell className="text-right">{sub.count}</TableCell>
                    <TableCell className="text-right">Rs. {sub.totalValue.toLocaleString()}</TableCell>
                    <TableCell className="text-right">Rs. {sub.avgValue.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={sub.activePercentage > 70 ? "default" : "secondary"}
                      >
                        {sub.activePercentage.toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={
                          sub.goodConditionPercentage > 70 
                            ? "default" 
                            : sub.goodConditionPercentage > 40 
                            ? "secondary" 
                            : "destructive"
                        }
                      >
                        {sub.goodConditionPercentage.toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={
                          sub.depreciationRate < 15 
                            ? "default" 
                            : sub.depreciationRate < 30 
                            ? "secondary" 
                            : "destructive"
                        }
                      >
                        {sub.depreciationRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
