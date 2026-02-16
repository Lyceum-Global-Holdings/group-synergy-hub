import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Package, MapPin, DollarSign, AlertTriangle, CheckCircle, Wrench, TrendingUp, Target } from "lucide-react";
import { WarehouseAsset, WarehouseLocation, AssetCategory } from "@/types/warehouse";

interface AssetAnalyticsProps {
  assets: WarehouseAsset[];
  locations: WarehouseLocation[];
  categories: AssetCategory[];
  totalCount?: number;
  activeCount?: number;
  maintenanceCount?: number;
}

const COLORS = [
  'hsl(217, 91%, 60%)', // Primary
  'hsl(199, 89%, 48%)', // Info  
  'hsl(142, 76%, 36%)', // Success
  'hsl(38, 92%, 50%)', // Warning
  'hsl(0, 84%, 60%)', // Destructive
  'hsl(240, 5%, 46%)', // Muted
];

export function AssetAnalytics({ assets, locations, categories, totalCount, activeCount, maintenanceCount }: AssetAnalyticsProps) {
  const analyticsData = useMemo(() => {
    // Category distribution
    const categoryData = categories.filter(cat => !cat.parent_id).map(category => {
      const count = assets.filter(asset => asset.category_id === category.id).length;
      const value = assets
        .filter(asset => asset.category_id === category.id)
        .reduce((sum, asset) => sum + (asset.current_value ?? asset.purchase_price ?? 0), 0);
      
      return {
        name: category.name,
        count,
        value,
      };
    }).filter(item => item.count > 0);

    // Status distribution
    const statusData = [
      { name: 'Active', count: assets.filter(a => a.status === 'active').length, color: 'hsl(142, 76%, 36%)' },
      { name: 'Maintenance', count: assets.filter(a => a.status === 'maintenance').length, color: 'hsl(38, 92%, 50%)' },
      { name: 'Inactive', count: assets.filter(a => a.status === 'inactive').length, color: 'hsl(0, 84%, 60%)' },
      { name: 'Disposed', count: assets.filter(a => a.status === 'disposed').length, color: 'hsl(240, 5%, 46%)' },
    ].filter(item => item.count > 0);

    // Condition distribution
    const conditionData = [
      { name: 'Good', count: assets.filter(a => a.condition === 'good').length, color: 'hsl(142, 76%, 36%)' },
      { name: 'Fair', count: assets.filter(a => a.condition === 'fair').length, color: 'hsl(38, 92%, 50%)' },
      { name: 'Poor', count: assets.filter(a => a.condition === 'poor').length, color: 'hsl(0, 84%, 60%)' },
      { name: 'Needs Repair', count: assets.filter(a => a.condition === 'needs_repair').length, color: 'hsl(0, 62%, 45%)' },
    ].filter(item => item.count > 0);

    // Location distribution
    const locationData = locations.filter(loc => loc.type === 'location').map(location => {
      const count = assets.filter(asset => asset.location_id === location.id).length;
      const value = assets
        .filter(asset => asset.location_id === location.id)
        .reduce((sum, asset) => sum + (asset.current_value ?? asset.purchase_price ?? 0), 0);
      
      return {
        name: location.name,
        count,
        value,
      };
    }).filter(item => item.count > 0);

    // Brand performance
    const brandData = assets
      .filter(asset => asset.brand && asset.brand.trim() !== '')
      .reduce((acc, asset) => {
        const brand = asset.brand!;
        if (!acc[brand]) {
          acc[brand] = { name: brand, count: 0, value: 0, goodCondition: 0 };
        }
        acc[brand].count += 1;
        acc[brand].value += (asset.current_value ?? asset.purchase_price ?? 0);
        if (asset.condition === 'good') acc[brand].goodCondition += 1;
        return acc;
      }, {} as Record<string, { name: string; count: number; value: number; goodCondition: number }>);

    const brandPerformance = Object.values(brandData)
      .map(brand => ({
        ...brand,
        reliabilityScore: (brand.goodCondition / brand.count) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Financial metrics
    const totalPurchaseValue = assets.reduce((sum, asset) => sum + (asset.purchase_price || 0), 0);
    const totalCurrentValue = assets.reduce((sum, asset) => sum + (asset.current_value ?? asset.purchase_price ?? 0), 0);
    const depreciation = totalPurchaseValue - totalCurrentValue;
    const depreciationRate = totalPurchaseValue > 0 ? (depreciation / totalPurchaseValue) * 100 : 0;

    return {
      categoryData,
      statusData,
      conditionData,
      locationData,
      brandPerformance,
      financial: {
        totalPurchaseValue,
        totalCurrentValue,
        depreciation,
        depreciationRate,
      },
      kpis: {
        totalAssets: totalCount ?? assets.length,
        activeAssets: activeCount ?? assets.filter(a => a.status === 'active').length,
        maintenanceAssets: maintenanceCount ?? assets.filter(a => a.status === 'maintenance').length,
        goodCondition: assets.filter(a => a.condition === 'good').length,
        utilizationRate: (totalCount ?? assets.length) > 0 ? ((activeCount ?? assets.filter(a => a.status === 'active').length) / (totalCount ?? assets.length)) * 100 : 0,
        avgAssetValue: (totalCount ?? assets.length) > 0 ? totalCurrentValue / (totalCount ?? assets.length) : 0,
      },
    };
  }, [assets, locations, categories]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-2 rounded shadow-md">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey}: ${entry.dataKey === 'value' ? `Rs. ${entry.value.toLocaleString()}` : entry.value}`}
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
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.kpis.totalAssets.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {analyticsData.kpis.activeAssets} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilization Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.kpis.utilizationRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Active vs total assets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {analyticsData.financial.totalCurrentValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Current asset value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Asset Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {analyticsData.kpis.avgAssetValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Per asset average
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Asset Status Distribution
            </CardTitle>
            <CardDescription>
              Current status of all assets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analyticsData.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Asset Condition Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Asset Condition Distribution
            </CardTitle>
            <CardDescription>
              Physical condition of assets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.conditionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analyticsData.conditionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Value Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Assets by Category</CardTitle>
            <CardDescription>
              Asset count and value distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--foreground))"
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="count" fill="hsl(217, 91%, 60%)" name="Count" />
                <Bar dataKey="value" fill="hsl(199, 89%, 48%)" name="Value ($)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Location Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Assets by Location
            </CardTitle>
            <CardDescription>
              Asset distribution across locations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.locationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--foreground))"
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="count" fill="hsl(142, 76%, 36%)" name="Asset Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Brand Performance and Financial Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brand Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Performance</CardTitle>
            <CardDescription>
              Reliability and asset count by brand
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.brandPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke="hsl(var(--foreground))"
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border border-border p-3 rounded shadow-md">
                          <p className="font-medium">{label}</p>
                          <p className="text-sm">Assets: {payload[0]?.payload?.count}</p>
                          <p className="text-sm">Reliability: {typeof payload[1]?.value === 'number' ? payload[1]?.value?.toFixed(1) : payload[1]?.value}%</p>
                          <p className="text-sm">Value: Rs. {payload[0]?.payload?.value?.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="count" fill="hsl(217, 91%, 60%)" name="Asset Count" />
                <Bar dataKey="reliabilityScore" fill="hsl(142, 76%, 36%)" name="Reliability %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Overview
            </CardTitle>
            <CardDescription>
              Asset value and depreciation analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 border rounded">
                <span className="text-sm font-medium">Original Purchase Value</span>
                <span className="text-lg font-bold text-success">
                  Rs. {analyticsData.financial.totalPurchaseValue.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 border rounded">
                <span className="text-sm font-medium">Current Asset Value</span>
                <span className="text-lg font-bold">
                  Rs. {analyticsData.financial.totalCurrentValue.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 border rounded">
                <span className="text-sm font-medium">Total Depreciation</span>
                <span className="text-lg font-bold text-destructive">
                  -Rs. {analyticsData.financial.depreciation.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 border rounded">
                <span className="text-sm font-medium">Depreciation Rate</span>
                <Badge variant={analyticsData.financial.depreciationRate > 30 ? "destructive" : analyticsData.financial.depreciationRate > 15 ? "secondary" : "default"}>
                  {analyticsData.financial.depreciationRate.toFixed(1)}%
                </Badge>
              </div>

              <div className="mt-4 p-3 bg-muted rounded">
                <p className="text-xs text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Asset depreciation analysis based on current vs purchase values.
                  Consider updating current values for accurate reporting.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}