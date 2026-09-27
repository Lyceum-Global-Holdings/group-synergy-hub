import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Search, FileText, TrendingUp, DollarSign, AlertTriangle,
  Eye, Edit, FileSignature, Pause, Ban, RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { 
  useBlanketPurchaseOrders, 
  useDeleteBlanketPurchaseOrder,
  useUpdateBpoStatus,
  useBpoSummaryStats
} from "@/hooks/useBlanketPurchaseOrders";
import { CreateBlanketPoDialog } from "@/components/procurement/CreateBlanketPoDialog";
import { BlanketPoDetailsDialog } from "@/components/procurement/BlanketPoDetailsDialog";
import { Progress } from "@/components/ui/progress";
import type { BlanketContractStatus } from "@/types/blanketPurchaseOrder";

const statusColors: Record<BlanketContractStatus, string> = {
  draft: "bg-gray-500",
  active: "bg-green-500",
  suspended: "bg-yellow-500",
  expired: "bg-red-500",
  closed: "bg-blue-500",
  cancelled: "bg-gray-700",
};

const statusLabels: Record<BlanketContractStatus, string> = {
  draft: "Draft",
  active: "Active",
  suspended: "Suspended",
  expired: "Expired",
  closed: "Closed",
  cancelled: "Cancelled",
};

export default function BlanketPurchaseOrderPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedBpoId, setSelectedBpoId] = useState<string | null>(null);

  const { data: bpos = [], isLoading } = useBlanketPurchaseOrders();
  // Read from the live list so remaining value and released quantities refresh after a release.
  const selectedBpo = bpos.find((b) => b.id === selectedBpoId) ?? null;
  const { data: stats } = useBpoSummaryStats();
  const deleteBpo = useDeleteBlanketPurchaseOrder();
  const updateStatus = useUpdateBpoStatus();

  const filteredBpos = bpos.filter((bpo) => {
    const matchesSearch = 
      bpo.bpo_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bpo.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "active" && bpo.contract_status === "active") ||
      (activeTab === "draft" && bpo.contract_status === "draft") ||
      (activeTab === "expiring" && bpo.contract_status === "active" &&
        new Date(bpo.contract_end_date).getTime() - Date.now() <= 30 * 24 * 60 * 60 * 1000) ||
      (activeTab === "expired" && bpo.contract_status === "expired");

    return matchesSearch && matchesTab;
  });

  const handleStatusChange = (id: string, status: BlanketContractStatus) => {
    updateStatus.mutate({ id, status });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this Blanket PO?")) {
      deleteBpo.mutate(id);
    }
  };

  const formatCurrency = (amount: number, currency = bpos[0]?.currency || 'LKR') =>
    `${currency} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return "text-green-600";
    if (utilization >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Blanket Purchase Orders</h1>
          <p className="text-muted-foreground">Manage long-term purchasing agreements</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Blanket PO
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Contracts</p>
              <p className="text-2xl font-bold">{stats?.total_bpos || 0}</p>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Contracts</p>
              <p className="text-2xl font-bold text-green-600">{stats?.active_bpos || 0}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">{formatCurrency(stats?.total_value || 0)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Utilization</p>
              <p className={`text-2xl font-bold ${getUtilizationColor(stats?.average_utilization || 0)}`}>
                {(stats?.average_utilization || 0).toFixed(1)}%
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Tabs and Filters */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by BPO number or supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All Contracts</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="expiring">Expiring Soon</TabsTrigger>
              <TabsTrigger value="expired">Expired</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BPO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Contract Period</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Utilization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBpos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No blanket purchase orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBpos.map((bpo) => {
                      const utilization = bpo.total_contract_value > 0
                        ? ((bpo.total_contract_value - bpo.remaining_value) / bpo.total_contract_value) * 100
                        : 0;

                      return (
                        <TableRow key={bpo.id}>
                          <TableCell className="font-medium">{bpo.bpo_number}</TableCell>
                          <TableCell>{bpo.supplier?.name || "N/A"}</TableCell>
                          <TableCell>
                            {format(new Date(bpo.contract_start_date), "MMM dd, yyyy")} →{" "}
                            {format(new Date(bpo.contract_end_date), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{formatCurrency(bpo.total_contract_value, bpo.currency)}</div>
                              <div className="text-muted-foreground">
                                {formatCurrency(bpo.remaining_value, bpo.currency)} remaining
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Progress value={utilization} className="h-2" />
                              <span className={`text-xs font-medium ${getUtilizationColor(utilization)}`}>
                                {utilization.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[bpo.contract_status]}>
                              {statusLabels[bpo.contract_status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedBpoId(bpo.id)}
                                aria-label={`Open ${bpo.bpo_number}`}
                                title="Open (items and releases)"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {bpo.contract_status === "draft" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStatusChange(bpo.id, "active")}
                                  aria-label={`Activate ${bpo.bpo_number}`}
                                  title="Activate (needs department head approval rights)"
                                >
                                  <FileSignature className="h-4 w-4" />
                                </Button>
                              )}
                              {bpo.contract_status === "active" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStatusChange(bpo.id, "suspended")}
                                >
                                  <Pause className="h-4 w-4" />
                                </Button>
                              )}
                              {bpo.contract_status === "suspended" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStatusChange(bpo.id, "active")}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(bpo.id)}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </div>
      </Card>

      {/* Dialogs */}
      <CreateBlanketPoDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {selectedBpo && (
        <BlanketPoDetailsDialog
          bpo={selectedBpo}
          open={!!selectedBpo}
          onOpenChange={(open) => !open && setSelectedBpoId(null)}
        />
      )}
    </div>
  );
}
