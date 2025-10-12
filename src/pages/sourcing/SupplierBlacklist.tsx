import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Ban, Eye, Flag } from "lucide-react";
import { useSupplierBlacklist } from "@/hooks/useSupplierBlacklist";
import { useSupplierRiskFlags } from "@/hooks/useSupplierRiskFlags";
import { usePendingReviews } from "@/hooks/useBlacklistReviews";
import { BlacklistTable } from "@/components/sourcing/blacklist/BlacklistTable";
import { RiskFlagsTable } from "@/components/sourcing/blacklist/RiskFlagsTable";
import { ReviewQueueTable } from "@/components/sourcing/blacklist/ReviewQueueTable";

export default function SupplierBlacklist() {
  const [activeTab, setActiveTab] = useState("blacklist");
  
  const { blacklistEntries, isLoading: isLoadingBlacklist } = useSupplierBlacklist();
  const { riskFlags, isLoading: isLoadingFlags } = useSupplierRiskFlags();
  const { data: pendingReviews, isLoading: isLoadingReviews } = usePendingReviews();

  // Calculate KPIs
  const activeBlacklisted = blacklistEntries?.filter(b => b.status === 'blacklisted').length || 0;
  const watchlistCount = blacklistEntries?.filter(b => b.status === 'watchlist').length || 0;
  const criticalFlags = riskFlags?.filter(f => f.risk_severity === 'critical' && f.status === 'active').length || 0;
  const pendingReviewsCount = pendingReviews?.length || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Supplier Blacklist & Risk Management</h1>
        <p className="text-muted-foreground mt-2">
          Monitor supplier risks, manage blacklist entries, and conduct periodic reviews
        </p>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Blacklisted</CardTitle>
              <Ban className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBlacklisted}</div>
            <p className="text-xs text-muted-foreground">Active suppliers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Watchlist</CardTitle>
              <Eye className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{watchlistCount}</div>
            <p className="text-xs text-muted-foreground">Under monitoring</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Critical Flags</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{criticalFlags}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <Flag className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReviewsCount}</div>
            <p className="text-xs text-muted-foreground">Due for review</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="blacklist">Blacklist Management</TabsTrigger>
          <TabsTrigger value="risk-flags">Risk Flags</TabsTrigger>
          <TabsTrigger value="reviews">Review Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="blacklist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blacklist Entries</CardTitle>
              <CardDescription>
                Manage suppliers on blacklist and watchlist
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BlacklistTable 
                data={blacklistEntries || []} 
                isLoading={isLoadingBlacklist}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk-flags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Flags</CardTitle>
              <CardDescription>
                Track and manage supplier risk flags across all categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RiskFlagsTable 
                data={riskFlags || []} 
                isLoading={isLoadingFlags}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Review Queue</CardTitle>
              <CardDescription>
                Suppliers requiring periodic blacklist review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReviewQueueTable 
                data={pendingReviews || []} 
                isLoading={isLoadingReviews}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
