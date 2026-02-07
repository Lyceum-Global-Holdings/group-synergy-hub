import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingDown, DollarSign, AlertTriangle, MapPin } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export function AssetReports() {
  const { selectedCompany } = useCompany();

  const { data: assets, isLoading } = useQuery({
    queryKey: ["fixed-assets-summary", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_assets")
        .select(`
          *,
          asset_master (
            asset_name
          ),
          category:asset_categories!warehouse_assets_category_id_fkey (
            name
          ),
          location:warehouse_locations!warehouse_assets_location_id_fkey (
            name
          )
        `)
        .eq("company_id", selectedCompany?.id);

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  // Fetch depreciation history for trend chart
  const { data: depreciationHistory } = useQuery({
    queryKey: ["depreciation-history", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("depreciation_schedule")
        .select("depreciation_amount, created_at, accounting_periods:period_id(period_name, fiscal_year)")
        .eq("company_id", selectedCompany?.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const totalAssets = assets?.length || 0;
  const totalCost = assets?.reduce((sum, a) => sum + (Number(a.purchase_price) || 0), 0) || 0;
  const totalDepreciation = assets?.reduce((sum, a) => sum + (Number(a.accumulated_depreciation) || 0), 0) || 0;
  const netBookValue = totalCost - totalDepreciation;
  const fullyDepreciated = assets?.filter((a) => {
    const cost = Number(a.purchase_price) || 0;
    const depr = Number(a.accumulated_depreciation) || 0;
    return depr >= cost && cost > 0;
  }).length || 0;

  // Group by category
  const categoryData = assets?.reduce((acc, asset) => {
    const category = (asset.category as any)?.name || "Uncategorized";
    if (!acc[category]) {
      acc[category] = { name: category, value: 0, count: 0 };
    }
    acc[category].value += Number(asset.purchase_price) || 0;
    acc[category].count += 1;
    return acc;
  }, {} as Record<string, { name: string; value: number; count: number }>);

  const pieData = Object.values(categoryData || {});

  // Group by location
  const locationData = assets?.reduce((acc, asset) => {
    const location = (asset.location as any)?.name || "Unassigned";
    if (!acc[location]) {
      acc[location] = { name: location, value: 0, count: 0 };
    }
    acc[location].value += Number(asset.purchase_price) || 0;
    acc[location].count += 1;
    return acc;
  }, {} as Record<string, { name: string; value: number; count: number }>);

  const locationPieData = Object.values(locationData || {});

  // Process depreciation trend data
  const depreciationTrend = depreciationHistory?.reduce((acc, entry) => {
    const period = entry.accounting_periods as any;
    const year = period?.fiscal_year?.toString() || "Unknown";
    if (!acc[year]) {
      acc[year] = { year, depreciation: 0 };
    }
    acc[year].depreciation += Number(entry.depreciation_amount) || 0;
    return acc;
  }, {} as Record<string, { year: string; depreciation: number }>);

  const trendData = Object.values(depreciationTrend || {}).slice(-5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssets}</div>
            <p className="text-xs text-muted-foreground">Physical fixed assets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
            <p className="text-xs text-muted-foreground">Original purchase value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Book Value</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(netBookValue)}</div>
            <p className="text-xs text-muted-foreground">After {formatCurrency(totalDepreciation)} depreciation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fully Depreciated</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{fullyDepreciated}</div>
            <p className="text-xs text-muted-foreground">Assets at zero book value</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assets by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No asset data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Assets by Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            {locationPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={locationPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {locationPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No location data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Annual Depreciation Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trendData.length > 0 ? trendData : [{ year: "No Data", depreciation: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="depreciation" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
