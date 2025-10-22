import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApprovalConsole } from "@/hooks/useApprovalConsole";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { ApprovalStats } from "@/components/approvals/ApprovalStats";
import { ApprovalFilters, ApprovalType, ApprovalPriority } from "@/types/approval";
import { Search, Filter, RefreshCw, Bell, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsAdmin } from "@/hooks/useSuperAdmin";

export default function ApprovalConsole() {
  const [filters, setFilters] = useState<ApprovalFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ApprovalType | "all">("all");
  
  const { data: isAdmin } = useIsAdmin();
  const { data: approvals, isLoading, refetch, isRefetching } = useApprovalConsole(filters);

  const handleFilterChange = (key: keyof ApprovalFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, searchQuery }));
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as ApprovalType | "all");
    if (value === "all") {
      handleFilterChange('type', undefined);
    } else {
      handleFilterChange('type', value as ApprovalType);
    }
  };

  const filteredApprovals = approvals || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approval Console</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin 
              ? "Centralized view of all pending approvals across the system"
              : "View and manage approvals assigned to you"
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="icon">
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Statistics */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <ApprovalStats approvals={filteredApprovals} />
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by reference number or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Select 
              value={filters.priority || "all"} 
              onValueChange={(v) => handleFilterChange('priority', v === 'all' ? undefined : v as ApprovalPriority)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.overdue ? "overdue" : "all"} 
              onValueChange={(v) => handleFilterChange('overdue', v === 'overdue')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="overdue">Overdue Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Approval Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="purchase_order">PO</TabsTrigger>
          <TabsTrigger value="purchase_requisition">PR</TabsTrigger>
          <TabsTrigger value="supplier_registration">Suppliers</TabsTrigger>
          <TabsTrigger value="customer_po">Customer PO</TabsTrigger>
          <TabsTrigger value="production_receipt">Production</TabsTrigger>
          <TabsTrigger value="asset_request">Assets</TabsTrigger>
          <TabsTrigger value="material_request">Materials</TabsTrigger>
          <TabsTrigger value="stock_transfer">Transfers</TabsTrigger>
          <TabsTrigger value="grn">GRN</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : filteredApprovals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium">
                  {isAdmin ? "No pending approvals found" : "No approvals assigned to you"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {isAdmin 
                    ? "All approvals across the system are up to date"
                    : "You don't have any pending approvals at the moment"
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredApprovals.map((approval) => (
                <ApprovalCard key={approval.id} approval={approval} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
