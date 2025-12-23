import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SalesOrderItemsView } from "./SalesOrderItemsView";
import { CreateDeliveryOrderDialog } from "./CreateDeliveryOrderDialog";
import { FinishedGoodsIssueDetailsDialog } from "./FinishedGoodsIssueDetailsDialog";
import { usePickPack } from "@/hooks/usePickPack";
import { FileText, Package, List, Clock, User, MapPin, Calendar, Eye, Truck, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface SalesOrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrderId: string;
}

export function SalesOrderDetailsDialog({
  open,
  onOpenChange,
  salesOrderId,
}: SalesOrderDetailsDialogProps) {
  const { useSalesOrders, usePickLists } = usePickPack();
  const { data: salesOrders, isLoading: loadingOrders } = useSalesOrders();
  const { data: allPickLists, isLoading: loadingPickLists } = usePickLists();
  const [showCreateDeliveryOrder, setShowCreateDeliveryOrder] = useState(false);
  const [showIssueDetails, setShowIssueDetails] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const salesOrder = salesOrders?.find((order) => order.id === salesOrderId);
  const relatedPickLists = allPickLists?.filter((pl) => pl.sales_order_id === salesOrderId) || [];

  // Fetch finished goods issues for this sales order
  const { data: relatedIssues } = useQuery({
    queryKey: ['finished-goods-issues', salesOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finished_goods_issues')
        .select('*')
        .eq('sales_order_id', salesOrderId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!salesOrderId,
  });

  // Fetch sales order items to check issued quantities
  const { data: salesOrderItems } = useQuery({
    queryKey: ['sales-order-items', salesOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_order_items')
        .select('id, quantity_ordered, quantity_issued, quantity_picked')
        .eq('sales_order_id', salesOrderId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!salesOrderId,
  });

  const hasIssuedItems = salesOrderItems?.some(item => item.quantity_issued > 0);

  const handleViewIssue = (issueId: string) => {
    setSelectedIssueId(issueId);
    setShowIssueDetails(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      confirmed: "secondary",
      picking: "default",
      picked: "default",
      packing: "default",
      packed: "default",
      ready_for_dispatch: "default",
      dispatched: "secondary",
      delivered: "secondary",
      completed: "secondary",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status.replace(/_/g, " ")}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "outline",
      medium: "secondary",
      high: "default",
      urgent: "destructive",
    };
    return <Badge variant={variants[priority] || "outline"}>{priority}</Badge>;
  };

  if (!salesOrder) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Sales Order Details</DialogTitle>
            <div className="flex gap-2">
              {getStatusBadge(salesOrder.status)}
              {salesOrder.priority && getPriorityBadge(salesOrder.priority)}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span className="font-semibold text-foreground text-lg">{salesOrder.order_number}</span>
            {salesOrder.order_date && (
              <span>
                <Calendar className="w-4 h-4 inline mr-1" />
                {format(new Date(salesOrder.order_date), "PPP")}
              </span>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">
              <FileText className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="items">
              <Package className="w-4 h-4 mr-2" />
              Items
            </TabsTrigger>
            <TabsTrigger value="issues">
              <AlertCircle className="w-4 h-4 mr-2" />
              Issues ({relatedIssues?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="picklists">
              <List className="w-4 h-4 mr-2" />
              Pick Lists ({relatedPickLists.length})
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <Clock className="w-4 h-4 mr-2" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <User className="w-4 h-4 mr-2" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {salesOrder.customer && (
                    <>
                      <div>
                        <span className="text-sm text-muted-foreground">Customer:</span>
                        <p className="font-medium">
                          {salesOrder.customer.customer_name || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Customer Code:</span>
                        <p className="font-medium">
                          {salesOrder.customer.customer_code || "N/A"}
                        </p>
                      </div>
                    </>
                  )}
                  {salesOrder.cpo && (
                    <div>
                      <span className="text-sm text-muted-foreground">Customer PO:</span>
                      <p className="font-medium">{salesOrder.cpo.cpo_number || "N/A"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <Calendar className="w-4 h-4 mr-2" />
                    Order Dates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {salesOrder.order_date && (
                    <div>
                      <span className="text-sm text-muted-foreground">Order Date:</span>
                      <p className="font-medium">{format(new Date(salesOrder.order_date), "PPP")}</p>
                    </div>
                  )}
                  {salesOrder.required_date && (
                    <div>
                      <span className="text-sm text-muted-foreground">Required Date:</span>
                      <p className="font-medium">{format(new Date(salesOrder.required_date), "PPP")}</p>
                    </div>
                  )}
                  {salesOrder.created_at && (
                    <div>
                      <span className="text-sm text-muted-foreground">Created:</span>
                      <p className="font-medium">{format(new Date(salesOrder.created_at), "PPP")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <MapPin className="w-4 h-4 mr-2" />
                    Delivery Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {salesOrder.delivery_address && (
                    <div>
                      <span className="text-sm text-muted-foreground">Delivery Address:</span>
                      <p className="font-medium whitespace-pre-wrap">{salesOrder.delivery_address}</p>
                    </div>
                  )}
                  {salesOrder.special_instructions && (
                    <div>
                      <span className="text-sm text-muted-foreground">Special Instructions:</span>
                      <p className="font-medium whitespace-pre-wrap">{salesOrder.special_instructions}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <Package className="w-4 h-4 mr-2" />
                    Fulfillment Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    {getStatusBadge(salesOrder.status)}
                  </div>
                  {salesOrder.priority && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Priority:</span>
                      {getPriorityBadge(salesOrder.priority)}
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Pick Lists:</span>
                    <span className="font-medium">{relatedPickLists.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Goods Issues:</span>
                    <span className="font-medium">{relatedIssues?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Issued Items:</span>
                    <span className="font-medium">
                      {salesOrderItems?.filter(item => item.quantity_issued > 0).length || 0} / {salesOrderItems?.length || 0}
                    </span>
                  </div>
                  {hasIssuedItems && salesOrder.status !== 'delivered' && salesOrder.status !== 'cancelled' && (
                    <Button 
                      onClick={() => setShowCreateDeliveryOrder(true)}
                      className="w-full mt-2"
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      Create Delivery Note
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {salesOrder.special_instructions && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Additional Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{salesOrder.special_instructions}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="items">
            <Card>
              <CardContent className="pt-6">
                {hasIssuedItems && salesOrder.status !== 'delivered' && salesOrder.status !== 'cancelled' && (
                  <div className="mb-4 flex justify-end">
                    <Button 
                      onClick={() => setShowCreateDeliveryOrder(true)}
                      variant="outline"
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      Create Delivery Note
                    </Button>
                  </div>
                )}
                <SalesOrderItemsView salesOrderId={salesOrderId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="issues" className="space-y-4">
            {!relatedIssues || relatedIssues.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No finished goods issues created yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {relatedIssues.map((issue) => (
                  <Card key={issue.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{issue.issue_number}</p>
                            <Badge variant={issue.status === 'issued' ? 'default' : 'outline'}>
                              {issue.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>{format(new Date(issue.issue_date), "PPP")}</span>
                            <span>•</span>
                            <span>{issue.issued_items}/{issue.total_items} items</span>
                          </div>
                          {issue.notes && (
                            <div className="mt-2 pt-2 border-t">
                              <p className="text-sm text-muted-foreground flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span className="italic">{issue.notes}</span>
                              </p>
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewIssue(issue.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="picklists" className="space-y-4">
            {relatedPickLists.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <List className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No pick lists created yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {relatedPickLists.map((pickList) => (
                  <Card key={pickList.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">{pickList.pick_list_number}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {pickList.pick_zone && <span>Zone: {pickList.pick_zone}</span>}
                            {pickList.created_at && (
                              <span>Created: {format(new Date(pickList.created_at), "PPP")}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(pickList.status)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {salesOrder.created_at && (
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <div className="w-0.5 h-full bg-border" />
                      </div>
                      <div className="pb-4">
                        <p className="font-medium">Order Created</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(salesOrder.created_at), "PPP p")}
                        </p>
                      </div>
                    </div>
                  )}
                  {relatedPickLists.map((pickList, index) => (
                    <div key={pickList.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        {index < relatedPickLists.length - 1 && <div className="w-0.5 h-full bg-border" />}
                      </div>
                      <div className="pb-4">
                        <p className="font-medium">Pick List Created: {pickList.pick_list_number}</p>
                        {pickList.created_at && (
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(pickList.created_at), "PPP p")}
                          </p>
                        )}
                        <Badge variant="outline" className="mt-1">
                          {pickList.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {relatedIssues?.map((issue) => (
                    <div key={issue.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <Package className="w-4 h-4 text-primary" />
                        <div className="w-0.5 h-full bg-border" />
                      </div>
                      <div className="pb-4">
                        <p className="font-medium">Goods Issued: {issue.issue_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(issue.issue_date), "PPP")}
                        </p>
                        {issue.notes && (
                          <p className="text-sm mt-1 italic text-muted-foreground">"{issue.notes}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <CreateDeliveryOrderDialog
          open={showCreateDeliveryOrder}
          onOpenChange={setShowCreateDeliveryOrder}
          salesOrderId={salesOrderId}
        />

        {showIssueDetails && selectedIssueId && (
          <FinishedGoodsIssueDetailsDialog
            open={showIssueDetails}
            onOpenChange={setShowIssueDetails}
            issueId={selectedIssueId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
