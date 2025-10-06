import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierAnalytics } from "@/lib/supplierAnalytics";
import { TrendingUp, TrendingDown, Minus, Award, AlertTriangle } from "lucide-react";

interface PerformanceOverviewProps {
  analytics: SupplierAnalytics[];
}

export const PerformanceOverview = ({ analytics }: PerformanceOverviewProps) => {
  const totalSuppliers = analytics.length;
  const totalDeliveries = analytics.reduce((sum, a) => sum + a.totalDeliveries, 0);
  const avgPerformance = analytics.length > 0
    ? analytics.reduce((sum, a) => sum + a.avgPerformanceRate, 0) / analytics.length
    : 0;

  const gradeDistribution = {
    A: analytics.filter(a => a.performanceGrade === 'A').length,
    B: analytics.filter(a => a.performanceGrade === 'B').length,
    C: analytics.filter(a => a.performanceGrade === 'C').length,
    D: analytics.filter(a => a.performanceGrade === 'D').length,
  };

  const improving = analytics.filter(a => a.trendDirection === 'improving').length;
  const declining = analytics.filter(a => a.trendDirection === 'declining').length;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalSuppliers}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {gradeDistribution.A} A-Grade • {gradeDistribution.B} B-Grade
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalDeliveries}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Across all suppliers
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Performance</CardTitle>
          <Minus className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgPerformance.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground mt-1">
            Overall supplier performance
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Performance Trends</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1 text-green-600">
              <TrendingUp className="h-4 w-4" />
              {improving}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="flex items-center gap-1 text-red-600">
              <TrendingDown className="h-4 w-4" />
              {declining}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Improving vs declining suppliers
          </p>
        </CardContent>
      </Card>
    </div>
  );
};