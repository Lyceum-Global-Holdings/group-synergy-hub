import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingDown, DollarSign, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export function AssetReports() {
  const { selectedCompany } = useCompany();

  const { data: assets, isLoading } = useQuery({
    queryKey: ["fixed-assets-summary", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_master")
        .select(`
          *,
          asset_categories (
            name
          )
        `)
        .eq("company_id", selectedCompany?.id);

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
    return depr >= cost;
  }).length || 0;

  // Group by category
  const categoryData = assets?.reduce((acc, asset) => {
    const category = (asset.asset_categories as any)?.name || "Uncategorized";
    if (!acc[category]) {
      acc[category] = { name: category, value: 0 };
    }
    acc[category].value += Number(asset.purchase_price) || 0;
    return acc;
  }, {} as Record<string, { name: string; value: number }>);

  const pieData = Object.values(categoryData || {});

  // Depreciation by year (sample)
  const depreciationTrend = [
    { year: "2020", depreciation: 45000 },
    { year: "2021", depreciation: 52000 },
    { year: "2022", depreciation: 58000 },
    { year: "2023", depreciation: 65000 },
    { year: "2024", depreciation: 72000 },
  ];

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
            <p className="text-xs text-muted-foreground">Registered fixed assets</p>
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
            <CardTitle>Annual Depreciation Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={depreciationTrend}>
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
    </div>
  );
}
