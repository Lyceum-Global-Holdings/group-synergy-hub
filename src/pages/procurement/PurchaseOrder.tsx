import { useState } from "react";
import { Plus, Search, Filter, Send, Eye, Edit, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { usePurchaseOrders, useDeletePurchaseOrder, useSendPurchaseOrder, usePoSummaryStats } from "@/hooks/usePurchaseOrders";
import { CreatePoDialog } from "@/components/procurement/CreatePoDialog";
import { PoDetailsDialog } from "@/components/procurement/PoDetailsDialog";
import { CreateGrnDialog } from "@/components/warehouse/CreateGrnDialog";
import { PurchaseOrder, PoStatus } from "@/types/purchaseOrder";
import { format } from "date-fns";

const statusColors: Record<PoStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending_approval: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  sent: "bg-blue-100 text-blue-800",
  acknowledged: "bg-yellow-100 text-yellow-800",
  partially_received: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabels: Record<PoStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  sent: "Sent",
  acknowledged: "Acknowledged",
  partially_received: "Partially Received",
  completed: "Completed", 
  cancelled: "Cancelled",
};

export default function PurchaseOrderPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PoStatus | "all">("all");
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showGrnDialog, setShowGrnDialog] = useState(false);

  const { data: purchaseOrders = [], isLoading } = usePurchaseOrders();
  const { data: summaryStats } = usePoSummaryStats();
  const deleteMutation = useDeletePurchaseOrder();
  const sendMutation = useSendPurchaseOrder();

  // Filter purchase orders
  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = 
      po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.pr?.pr_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setShowDetailsDialog(true);
  };

  const handleEdit = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setShowDetailsDialog(true);
  };

  const handleReceiveGoods = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setShowGrnDialog(true);
  };

  const handleSend = (po: PurchaseOrder) => {
    sendMutation.mutate(po.id);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const canEdit = (po: PurchaseOrder) => po.status === 'draft';
  const canSubmit = (po: PurchaseOrder) => po.status === 'draft';
  const canApprove = (po: PurchaseOrder) => po.status === 'pending_approval';
  const canSend = (po: PurchaseOrder) => po.status === 'approved';
  const canReceive = (po: PurchaseOrder) => ['sent', 'acknowledged', 'partially_received'].includes(po.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage your purchase orders and track deliveries</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Purchase Order
        </Button>
      </div>

      {/* Summary Cards */}
      {summaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total POs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.total_pos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.pending_deliveries}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.completed_pos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rs. {summaryStats.total_value.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by PO number, supplier, or PR number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PoStatus | "all")}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="partially_received">Partially Received</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading purchase orders...</div>
          ) : filteredPOs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || statusFilter !== "all" 
                ? "No purchase orders found matching your criteria." 
                : "No purchase orders created yet."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>PR Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PO Date</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPOs.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.po_number}</TableCell>
                    <TableCell>{po.supplier?.name}</TableCell>
                    <TableCell>{po.pr?.pr_number || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[po.status]}>
                        {statusLabels[po.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(po.po_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      {po.expected_delivery_date 
                        ? format(new Date(po.expected_delivery_date), 'MMM dd, yyyy')
                        : '-'
                      }
                    </TableCell>
                    <TableCell>Rs. {po.final_amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewDetails(po)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEdit(po) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(po)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canSend(po) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSend(po)}
                            disabled={sendMutation.isPending}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {canReceive(po) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReceiveGoods(po)}
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                        )}
                        {canEdit(po) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete PO {po.po_number}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(po.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreatePoDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />
      
      {selectedPo && (
        <>
          <PoDetailsDialog
            open={showDetailsDialog}
            onOpenChange={setShowDetailsDialog}
            purchaseOrder={selectedPo}
          />
          <CreateGrnDialog
            open={showGrnDialog}
            onOpenChange={setShowGrnDialog}
            preselectedPo={selectedPo}
          />
        </>
      )}
    </div>
  );
}