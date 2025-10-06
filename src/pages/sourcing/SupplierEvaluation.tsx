import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { PerformanceOverview } from "@/components/sourcing/analytics/PerformanceOverview";
import { PerformanceTrendsChart } from "@/components/sourcing/analytics/PerformanceTrendsChart";
import { SupplierRankingTable } from "@/components/sourcing/analytics/SupplierRankingTable";
import { useSupplierAnalytics, useSupplierEvaluationsBySupplier } from "@/hooks/useSupplierAnalytics";
import { calculatePerformanceTrends } from "@/lib/supplierAnalytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const SupplierEvaluation = () => {
  const navigate = useNavigate();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  
  const { data: analytics, isLoading, error } = useSupplierAnalytics();
  const { data: supplierEvaluations } = useSupplierEvaluationsBySupplier(selectedSupplierId);

  const selectedSupplier = analytics?.find(a => a.supplierId === selectedSupplierId);
  const performanceTrends = supplierEvaluations ? calculatePerformanceTrends(supplierEvaluations) : [];

  const handleViewDetails = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Supplier Evaluation</h1>
            <p className="text-muted-foreground">
              Comprehensive analytics and performance insights
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load supplier analytics. Please try again.
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Supplier Evaluation
            </h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive analytics and performance insights
            </p>
          </div>
          <Button onClick={() => navigate('/sourcing/supplier-scorecard')}>
            View Scorecards
          </Button>
        </div>

        {/* Overview Cards */}
        {analytics && <PerformanceOverview analytics={analytics} />}

        {/* Performance Trends Chart */}
        {selectedSupplierId && selectedSupplier ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Detailed Analysis</h2>
              <Button 
                variant="outline" 
                onClick={() => setSelectedSupplierId(null)}
              >
                Clear Selection
              </Button>
            </div>
            <PerformanceTrendsChart 
              trends={performanceTrends} 
              supplierName={selectedSupplier.supplierName}
            />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>
                Select a supplier from the ranking table below to view detailed trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Click the eye icon in the ranking table to view supplier trends
              </div>
            </CardContent>
          </Card>
        )}

        {/* Supplier Rankings */}
        {analytics && (
          <SupplierRankingTable 
            analytics={analytics} 
            onViewDetails={handleViewDetails}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default SupplierEvaluation;