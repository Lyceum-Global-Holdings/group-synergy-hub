import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, ArrowRightLeft, Wrench, AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { useConstructionResources } from "@/hooks/construction/useConstructionResources";
import { useInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import { useRecentTransactions, useTransferTransactions } from "@/hooks/construction/useRecentTransactions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Helper to format transaction type for display
function formatTransactionType(type: string): string {
  const typeMap: Record<string, string> = {
    'stock_addition': 'Stock Addition',
    'stock_removal': 'Stock Removal',
    'transfer': 'Transfer',
    'adjustment': 'Adjustment',
    'allocation': 'Allocation',
    'return': 'Return',
    'repair_sent': 'Sent for Repair',
    'repair_returned': 'Returned from Repair',
    'new_item': 'New Item Added',
  };
  return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Helper to get badge variant based on transaction type
function getTransactionBadgeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  if (type === 'stock_removal' || type === 'allocation' || type === 'repair_sent') return 'destructive';
  if (type === 'stock_addition' || type === 'return' || type === 'repair_returned' || type === 'new_item') return 'default';
  if (type === 'adjustment') return 'secondary';
  if (type === 'transfer') return 'outline';
  return 'outline';
}

export function AllocationDashboard() {
  const { data: resources } = useConstructionResources();
  const { data: inventoryMaster } = useInventoryMaster();
  const { data: recentTransactions, isLoading: transactionsLoading } = useRecentTransactions(10);
  const { data: transferTransactions, isLoading: transfersLoading } = useTransferTransactions(50);

  // Filter for material resources only
  const materialResources = resources?.filter((r) => r.resource_type === "material") || [];
  
  // Calculate KPIs
  const totalAllocated = materialResources.reduce((sum, r) => sum + (r.quantity_allocated || 0), 0);
  const totalUsed = materialResources.reduce((sum, r) => sum + (r.quantity_used || 0), 0);
  const activeAllocations = materialResources.filter(r => r.status === "active").length;
  const totalMasterItems = inventoryMaster?.length || 0;

  const kpiCards = [
    {
      title: "Total Items Allocated",
      value: totalAllocated.toLocaleString(),
      icon: Package,
      description: "Across all projects",
      color: "text-blue-500",
    },
    {
      title: "Total Items Used",
      value: totalUsed.toLocaleString(),
      icon: Package,
      description: "Consumed from allocation",
      color: "text-green-500",
    },
    {
      title: "Active Allocations",
      value: activeAllocations.toString(),
      icon: ArrowRightLeft,
      description: "Currently allocated",
      color: "text-purple-500",
    },
    {
      title: "Master Items",
      value: totalMasterItems.toString(),
      icon: Package,
      description: "In inventory catalog",
      color: "text-orange-500",
    },
  ];

  // Recent allocations
  const recentAllocations = materialResources.slice(0, 5);

  // Low stock alerts (items where used > 80% of allocated)
  const lowStockItems = materialResources.filter(r => {
    const allocated = r.quantity_allocated || 0;
    const used = r.quantity_used || 0;
    return allocated > 0 && (used / allocated) > 0.8;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Allocations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Recent Allocations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAllocations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No allocations found
              </p>
            ) : (
              <div className="space-y-3">
                {recentAllocations.map((allocation) => (
                  <div
                    key={allocation.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div>
                      <p className="font-medium text-sm">{allocation.resource_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {allocation.project?.project_name || "Unassigned"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {allocation.quantity_used || 0} / {allocation.quantity_allocated || 0}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {allocation.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No low stock alerts
              </p>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map((item) => {
                  const allocated = item.quantity_allocated || 0;
                  const used = item.quantity_used || 0;
                  const percentage = allocated > 0 ? Math.round((used / allocated) * 100) : 0;
                  
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.resource_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.project?.project_name || "Unassigned"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                          {percentage}% used
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {allocated - used} remaining
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions Tabs - Recent Transactions and Transfer History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="recent" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="recent">Recent Transactions</TabsTrigger>
              <TabsTrigger value="transfers">Transfers History</TabsTrigger>
            </TabsList>
            
            {/* Recent Transactions Tab */}
            <TabsContent value="recent">
              {transactionsLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Loading transactions...
                </p>
              ) : !recentTransactions || recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No transactions found
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Performed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(transaction.created_at), 'yyyy-MM-dd HH:mm')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getTransactionBadgeVariant(transaction.transaction_type)}>
                              {formatTransactionType(transaction.transaction_type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {transaction.item_name || 'Unknown Item'}
                          </TableCell>
                          <TableCell>
                            {transaction.from_location || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {transaction.from_location && transaction.to_location && (
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              )}
                              {transaction.to_location || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {Math.abs(transaction.quantity_change)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {transaction.performed_by || 'System'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Transfers History Tab */}
            <TabsContent value="transfers">
              {transfersLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Loading transfer history...
                </p>
              ) : !transferTransactions || transferTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No transfer history found
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>From Location</TableHead>
                        <TableHead>To Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Performed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transferTransactions.map((transfer) => (
                        <TableRow key={transfer.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(transfer.created_at), 'yyyy-MM-dd HH:mm')}
                          </TableCell>
                          <TableCell className="font-medium">
                            {transfer.item_name || 'Unknown Item'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {Math.abs(transfer.quantity_change)}
                          </TableCell>
                          <TableCell>
                            {transfer.unit || '-'}
                          </TableCell>
                          <TableCell>
                            {transfer.from_location || '-'}
                          </TableCell>
                          <TableCell>
                            {transfer.to_location || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-500">
                              Completed
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {transfer.performed_by || 'System'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <MapPin className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">
                  {new Set(materialResources.map(r => r.project_id).filter(Boolean)).size}
                </p>
                <p className="text-sm text-muted-foreground">Projects with Inventory</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <ArrowRightLeft className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{transferTransactions?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Transfers</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Wrench className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Items in Repair</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
