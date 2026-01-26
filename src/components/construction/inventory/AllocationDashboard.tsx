import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Wrench, 
  MapPin, 
  ArrowRightLeft, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import { useDashboardStats, useTransactions } from "@/hooks/construction/useConstructionInventory";
import { ITEM_CATEGORIES } from "@/types/construction-inventory";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function AllocationDashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats, isFetching: isRefetching } = useDashboardStats();
  const { data: transactions, isLoading: txLoading, refetch: refetchTx } = useTransactions(10);

  const handleRefresh = async () => {
    // Invalidate all construction inventory related queries
    await queryClient.invalidateQueries({ queryKey: ["construction-item-master"] });
    await queryClient.invalidateQueries({ queryKey: ["construction-serial-numbers"] });
    await queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
    await queryClient.invalidateQueries({ queryKey: ["construction-dashboard-stats"] });
    await queryClient.invalidateQueries({ queryKey: ["construction-transactions"] });
    await queryClient.invalidateQueries({ queryKey: ["construction-inventory-transfers"] });
    await queryClient.invalidateQueries({ queryKey: ["construction-repair-records"] });
    
    // Refetch dashboard data
    await Promise.all([refetchStats(), refetchTx()]);
    toast.success("Dashboard refreshed");
  };

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalItems || 0}</div>
            <p className="text-xs text-muted-foreground">
              In Item Master
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Machines (Serial)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.serialStats.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.serialStats.available || 0} available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Quantity</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.stockStats.totalQuantity || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.stockStats.reservedQuantity || 0} reserved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Under Repair</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {(stats?.repairStats.sentForRepair || 0) + (stats?.repairStats.inRepair || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Items being serviced
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown & Transfer Summary */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inventory by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ITEM_CATEGORIES.map(cat => (
                <div key={cat.value} className="flex items-center justify-between">
                  <span className="text-sm">{cat.label}</span>
                  <Badge variant="secondary">
                    {stats?.categoryCount[cat.value] || 0}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transfer Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Pending</span>
                </div>
                <Badge variant="outline" className="bg-yellow-50">
                  {stats?.transferStats.pending || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">In Transit</span>
                </div>
                <Badge variant="outline" className="bg-blue-50">
                  {stats?.transferStats.inTransit || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Completed</span>
                </div>
                <Badge variant="outline" className="bg-green-50">
                  {stats?.transferStats.completed || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Machine Availability & Repair Status */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Machine Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Working</span>
                </div>
                <Badge className="bg-green-100 text-green-800">
                  {stats?.serialStats.working || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Under Repair</span>
                </div>
                <Badge className="bg-orange-100 text-orange-800">
                  {stats?.serialStats.underRepair || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Available</span>
                </div>
                <Badge className="bg-blue-100 text-blue-800">
                  {stats?.serialStats.available || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Repair Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Sent for Repair</span>
                <Badge variant="outline">{stats?.repairStats.sentForRepair || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">In Repair</span>
                <Badge variant="outline">{stats?.repairStats.inRepair || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Repaired (Pending Return)</span>
                <Badge variant="outline">{stats?.repairStats.repaired || 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">
                      {tx.transaction_type.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-sm font-medium">
                      {tx.item_master?.item_name || "Unknown Item"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${tx.quantity_change > 0 ? "text-green-600" : "text-red-600"}`}>
                      {tx.quantity_change > 0 ? "+" : ""}{tx.quantity_change}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(tx.transaction_date), "MMM d, HH:mm")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No transactions yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {(stats?.serialStats.underRepair || 0) > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-700">
              {stats?.serialStats.underRepair} machine(s) are currently under repair.
              {(stats?.repairStats.repaired || 0) > 0 && ` ${stats?.repairStats.repaired} item(s) are repaired and pending return.`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
