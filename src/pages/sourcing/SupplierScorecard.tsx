import { useState } from "react";

import { PerformanceOverview } from "@/components/sourcing/analytics/PerformanceOverview";
import { PerformanceTrendsChart } from "@/components/sourcing/analytics/PerformanceTrendsChart";
import { SupplierRankingTable } from "@/components/sourcing/analytics/SupplierRankingTable";
import { SupplierComparisonTab } from "@/components/sourcing/analytics/SupplierComparisonTab";
import { ItemAnalysisTab } from "@/components/sourcing/analytics/ItemAnalysisTab";
import { RiskAssessmentTab } from "@/components/sourcing/analytics/RiskAssessmentTab";
import { FinancialIntelligenceTab } from "@/components/sourcing/analytics/FinancialIntelligenceTab";
import { RecommendationsTab } from "@/components/sourcing/analytics/RecommendationsTab";
import { useSupplierAnalytics, useSupplierEvaluationsBySupplier } from "@/hooks/useSupplierAnalytics";
import { useSupplierEvaluations } from "@/hooks/useSupplierEvaluations";
import { calculatePerformanceTrends } from "@/lib/supplierAnalytics";
import { generateRecommendations } from "@/lib/supplierRecommendations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";

export default function SupplierScorecard() {
  const navigate = useNavigate();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  const { data: analytics, isLoading, error } = useSupplierAnalytics();
  const { data: supplierEvaluations } = useSupplierEvaluationsBySupplier(selectedSupplierId);
  const { data: allEvaluations } = useSupplierEvaluations();

  const selectedSupplier = analytics?.find((a) => a.supplierId === selectedSupplierId);
  const performanceTrends = supplierEvaluations ? calculatePerformanceTrends(supplierEvaluations) : [];
  const recommendations =
    analytics && allEvaluations ? generateRecommendations(analytics, allEvaluations) : [];

  const handleViewDetails = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Supplier Scorecard</h1>
          <p className="text-muted-foreground">
            Advanced analytics and performance insights
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
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load supplier analytics. Please try again.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Supplier Scorecard Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Advanced analytics and performance insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateReportButton template="SR-SUP-SCORE-001" />
          <Button onClick={() => navigate("/sourcing/supplier-evaluation")}>
            <FileText className="mr-2 h-4 w-4" />
            Manage Evaluations
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {analytics && <PerformanceOverview analytics={analytics} />}

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="recommendations">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Performance Trends Chart */}
          {selectedSupplierId && selectedSupplier ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Detailed Analysis</h2>
                <Button variant="outline" onClick={() => setSelectedSupplierId(null)}>
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
          {analytics && <SupplierRankingTable analytics={analytics} onViewDetails={handleViewDetails} />}
        </TabsContent>

        <TabsContent value="comparison">
          {analytics && <SupplierComparisonTab analytics={analytics} />}
        </TabsContent>

        <TabsContent value="items">
          {allEvaluations && <ItemAnalysisTab evaluations={allEvaluations} />}
        </TabsContent>

        <TabsContent value="risks">{analytics && <RiskAssessmentTab analytics={analytics} />}</TabsContent>

        <TabsContent value="financial">
          {analytics && <FinancialIntelligenceTab analytics={analytics} />}
        </TabsContent>

        <TabsContent value="recommendations">
          <RecommendationsTab recommendations={recommendations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}