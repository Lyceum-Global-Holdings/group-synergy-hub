import { useState } from "react";
import { useDeliveryOrders } from "@/hooks/useDeliveryOrders";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Truck, Package, CheckCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateDeliveryOrderDialog } from "@/components/warehouse/CreateDeliveryOrderDialog";
import { DeliveryOrderDetailsDialog } from "@/components/warehouse/DeliveryOrderDetailsDialog";
import { format } from "date-fns";

export default function DeliveryOrder() {
  const { selectedCompany } = useCompany();
  const { useDeliveryOrdersQuery } = useDeliveryOrders();
  const { data: deliveryOrders = [], isLoading } = useDeliveryOrdersQuery(selectedCompany?.id);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedDO, setSelectedDO] = useState<string | undefined>();

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "draft":
        return "secondary";
      case "in_transit":
        return "outline";
      case "delivered":
        return "default";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const filterByStatus = (status: string[]) => {
    return deliveryOrders.filter(do_ => status.includes(do_.status));
  };

  const handleViewDO = (doId: string) => {
    setSelectedDO(doId);
    setShowDetailsDialog(true);
  };

  const renderDOTable = (filteredDOs: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>DO Number</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Sales Order</TableHead>
          <TableHead>Delivery Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredDOs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              No delivery orders found
            </TableCell>
          </TableRow>
        ) : (
          filteredDOs.map((do_) => (
            <TableRow key={do_.id}>
              <TableCell className="font-medium">{do_.do_number}</TableCell>
              <TableCell>
                {do_.customers?.customer_name || "N/A"}
              </TableCell>
              <TableCell>{do_.sales_orders?.order_number || "N/A"}</TableCell>
              <TableCell>{format(new Date(do_.delivery_date), "PP")}</TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(do_.status)}>
                  {do_.status.replace(/_/g, " ").toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getPriorityBadgeVariant(do_.priority)}>
                  {do_.priority.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewDO(do_.id)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Delivery Orders</h1>
          <p className="text-muted-foreground">
            Manage delivery orders and logistics
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Delivery Order
        </Button>
      </div>

      <Card className="p-6">
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">
              <Package className="h-4 w-4 mr-2" />
              All Orders
            </TabsTrigger>
            <TabsTrigger value="pending">
              <FileText className="h-4 w-4 mr-2" />
              Pending Approval
            </TabsTrigger>
            <TabsTrigger value="ready">
              <Truck className="h-4 w-4 mr-2" />
              Ready for Dispatch
            </TabsTrigger>
            <TabsTrigger value="transit">
              <Truck className="h-4 w-4 mr-2" />
              In Transit
            </TabsTrigger>
            <TabsTrigger value="delivered">
              <CheckCircle className="h-4 w-4 mr-2" />
              Delivered
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading delivery orders...
              </div>
            ) : (
              renderDOTable(deliveryOrders)
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {renderDOTable(filterByStatus(["draft", "pending_approval"]))}
          </TabsContent>

          <TabsContent value="ready" className="space-y-4">
            {renderDOTable(filterByStatus(["approved"]))}
          </TabsContent>

          <TabsContent value="transit" className="space-y-4">
            {renderDOTable(filterByStatus(["in_transit"]))}
          </TabsContent>

          <TabsContent value="delivered" className="space-y-4">
            {renderDOTable(filterByStatus(["delivered"]))}
          </TabsContent>
        </Tabs>
      </Card>

      <CreateDeliveryOrderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {selectedDO && (
        <DeliveryOrderDetailsDialog
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          deliveryOrderId={selectedDO}
        />
      )}
    </div>
  );
}
