import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Package, Truck, CheckCircle, Clock, User, MapPin, List, FileText, Eye, AlertCircle } from 'lucide-react';
import { usePickPack } from '@/hooks/usePickPack';
import { useDeliveryOrders } from '@/hooks/useDeliveryOrders';
import { useCompany } from '@/contexts/CompanyContext';
import { CreateSalesOrderDialog } from './CreateSalesOrderDialog';
import { CreatePickListDialog } from './CreatePickListDialog';
import { CreateDeliveryOrderDialog } from './CreateDeliveryOrderDialog';
import { DeliveryOrderDetailsDialog } from './DeliveryOrderDetailsDialog';
import { SalesOrderDetailsDialog } from './SalesOrderDetailsDialog';
import { SalesOrderItemsView } from './SalesOrderItemsView';
import { FinishedGoodsIssueDetailsDialog } from './FinishedGoodsIssueDetailsDialog';
import { format } from 'date-fns';

export function SalesOrderFulfillmentTab() {
  const { selectedCompany } = useCompany();
  const { 
    useConfirmedCPOs, 
    useSalesOrders, 
    usePickLists,
    useFinishedGoodsIssues
  } = usePickPack();
  const { useDeliveryOrdersQuery } = useDeliveryOrders();
  
  const { data: confirmedCPOs, isLoading: loadingCPOs } = useConfirmedCPOs();
  const { data: salesOrders, isLoading: loadingSalesOrders } = useSalesOrders();
  const { data: pickLists, isLoading: loadingPickLists } = usePickLists();
  const { data: finishedGoodsIssues, isLoading: loadingIssues } = useFinishedGoodsIssues();
  const { data: deliveryOrders, isLoading: loadingDeliveryOrders } = useDeliveryOrdersQuery(selectedCompany?.id);
  
  const [showCreateSalesOrder, setShowCreateSalesOrder] = useState(false);
  const [showCreatePickList, setShowCreatePickList] = useState(false);
  const [showCreateDeliveryOrder, setShowCreateDeliveryOrder] = useState(false);
  const [showDeliveryOrderDetails, setShowDeliveryOrderDetails] = useState(false);
  const [showSalesOrderDetails, setShowSalesOrderDetails] = useState(false);
  const [showIssueDetails, setShowIssueDetails] = useState(false);
  const [selectedCPO, setSelectedCPO] = useState<any>(null);
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<any>(null);
  const [selectedDeliveryOrder, setSelectedDeliveryOrder] = useState<string | null>(null);
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [viewItemsForOrder, setViewItemsForOrder] = useState<string | null>(null);

  const handleCreateSalesOrderFromCPO = (cpo: any) => {
    setSelectedCPO(cpo);
    setShowCreateSalesOrder(true);
  };

  const handleCreatePickList = (salesOrder: any) => {
    setSelectedSalesOrder(salesOrder);
    setShowCreatePickList(true);
  };

  const handleCreateDeliveryOrder = (salesOrder: any) => {
    setSelectedSalesOrder(salesOrder);
    setShowCreateDeliveryOrder(true);
  };

  const handleViewDeliveryOrder = (doId: string) => {
    setSelectedDeliveryOrder(doId);
    setShowDeliveryOrderDetails(true);
  };

  const handleViewSalesOrder = (orderId: string) => {
    setSelectedSalesOrderId(orderId);
    setShowSalesOrderDetails(true);
  };

  const handleViewIssue = (issueId: string) => {
    setSelectedIssueId(issueId);
    setShowIssueDetails(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { variant: 'default' as const, label: 'Confirmed' },
      picking: { variant: 'secondary' as const, label: 'Picking' },
      picked: { variant: 'default' as const, label: 'Picked' },
      packing: { variant: 'secondary' as const, label: 'Packing' },
      packed: { variant: 'default' as const, label: 'Packed' },
      dispatched: { variant: 'outline' as const, label: 'Dispatched' },
      delivered: { variant: 'default' as const, label: 'Delivered' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: 'default' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { variant: 'outline' as const, label: 'Low' },
      medium: { variant: 'secondary' as const, label: 'Medium' },
      high: { variant: 'default' as const, label: 'High' },
      urgent: { variant: 'destructive' as const, label: 'Urgent' }
    };

    const config = priorityConfig[priority as keyof typeof priorityConfig] || { variant: 'default' as const, label: priority };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pick, Pack & Dispatch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ready-orders" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="ready-orders">Ready Orders</TabsTrigger>
              <TabsTrigger value="sales-orders">Sales Orders</TabsTrigger>
              <TabsTrigger value="pick-lists">Pick Lists</TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
              <TabsTrigger value="delivery-orders">Delivery Orders</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            </TabsList>

            <TabsContent value="ready-orders" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Confirmed Customer Orders</h3>
                <p className="text-sm text-muted-foreground">
                  Ready for sales order creation and fulfillment
                </p>
              </div>

              {loadingCPOs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading confirmed orders...</div>
                </div>
              ) : confirmedCPOs && confirmedCPOs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CPO Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {confirmedCPOs.map((cpo) => (
                      <TableRow key={cpo.id}>
                        <TableCell className="font-medium">{cpo.cpo_number}</TableCell>
                        <TableCell>{cpo.customers?.customer_name}</TableCell>
                        <TableCell>{cpo.customer_po_items?.length || 0}</TableCell>
                        <TableCell>${cpo.total_amount?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell>{format(new Date(cpo.po_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            onClick={() => handleCreateSalesOrderFromCPO(cpo)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Create Sales Order
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No confirmed customer orders ready for fulfillment
                </div>
              )}
            </TabsContent>

            <TabsContent value="sales-orders" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Sales Orders</h3>
              </div>

              {loadingSalesOrders ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading sales orders...</div>
                </div>
              ) : salesOrders && salesOrders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Required Date</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{order.customer?.customer_name}</TableCell>
                        <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>
                          {order.required_date ? format(new Date(order.required_date), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {order.picked_items}/{order.total_items} picked
                          </div>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewSalesOrder(order.id)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewItemsForOrder(order.id)}
                          >
                            <List className="w-4 h-4 mr-1" />
                            Items
                          </Button>
                          {order.status === 'confirmed' && (
                            <Button 
                              size="sm"
                              onClick={() => handleCreatePickList(order)}
                            >
                              <Package className="h-4 w-4 mr-1" />
                              Pick List
                            </Button>
                          )}
                          {(order.status === 'picked' || order.status === 'packed') && order.picked_items > 0 && (
                            <Button 
                              size="sm"
                              onClick={() => handleCreateDeliveryOrder(order)}
                            >
                              <Truck className="h-4 w-4 mr-1" />
                              Delivery Order
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No sales orders found
                </div>
              )}
            </TabsContent>

            <TabsContent value="pick-lists" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Pick Lists</h3>
              </div>

              {loadingPickLists ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading pick lists...</div>
                </div>
              ) : pickLists && pickLists.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pick List #</TableHead>
                      <TableHead>Sales Order</TableHead>
                      <TableHead>Picker</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Zone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pickLists.map((pickList) => (
                      <TableRow key={pickList.id}>
                        <TableCell className="font-medium">{pickList.pick_list_number}</TableCell>
                        <TableCell>{pickList.sales_order?.order_number}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {pickList.picker?.full_name || 'Unassigned'}
                          </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(pickList.priority)}</TableCell>
                        <TableCell>{getStatusBadge(pickList.status)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {pickList.picked_items}/{pickList.total_items} items
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {pickList.pick_zone || 'Not specified'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No pick lists found
                </div>
              )}
            </TabsContent>

            <TabsContent value="issues" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Finished Goods Issues</h3>
              </div>

              {loadingIssues ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading issues...</div>
                </div>
              ) : finishedGoodsIssues && finishedGoodsIssues.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue Number</TableHead>
                      <TableHead>Sales Order</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finishedGoodsIssues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="font-medium">{issue.issue_number}</TableCell>
                        <TableCell>{issue.sales_orders?.order_number || '-'}</TableCell>
                        <TableCell>{format(new Date(issue.issue_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{getStatusBadge(issue.status)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {issue.issued_items}/{issue.total_items}
                          </div>
                        </TableCell>
                        <TableCell>
                          {issue.notes ? (
                            <div className="flex items-center gap-2 max-w-xs">
                              <AlertCircle className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground truncate">
                                {issue.notes.substring(0, 50)}
                                {issue.notes.length > 50 && '...'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewIssue(issue.id)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No finished goods issues found
                </div>
              )}
            </TabsContent>

            <TabsContent value="delivery-orders" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Delivery Orders</h3>
              </div>

              {loadingDeliveryOrders ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading delivery orders...</div>
                </div>
              ) : deliveryOrders && deliveryOrders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DO Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Sales Order</TableHead>
                      <TableHead>Delivery Date</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveryOrders.map((deliveryOrder) => (
                      <TableRow key={deliveryOrder.id}>
                        <TableCell className="font-medium">{deliveryOrder.do_number}</TableCell>
                        <TableCell>{deliveryOrder.customer?.customer_name}</TableCell>
                        <TableCell>{deliveryOrder.sales_order?.order_number}</TableCell>
                        <TableCell>
                          {format(new Date(deliveryOrder.delivery_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>{getPriorityBadge(deliveryOrder.priority)}</TableCell>
                        <TableCell>{getStatusBadge(deliveryOrder.status)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDeliveryOrder(deliveryOrder.id)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No delivery orders found
                </div>
              )}
            </TabsContent>

            <TabsContent value="dashboard" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{confirmedCPOs?.length || 0}</div>
                    <p className="text-xs text-muted-foreground">Ready for fulfillment</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Picks</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {pickLists?.filter(p => p.status === 'in_progress').length || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">In progress</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {pickLists?.filter(p => p.status === 'completed').length || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Pick lists completed</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CreateSalesOrderDialog
        open={showCreateSalesOrder}
        onOpenChange={setShowCreateSalesOrder}
        cpoId={selectedCPO?.id}
        customerId={selectedCPO?.customer_id}
      />

      <CreatePickListDialog
        open={showCreatePickList}
        onOpenChange={setShowCreatePickList}
        salesOrderId={selectedSalesOrder?.id}
      />

      <CreateDeliveryOrderDialog
        open={showCreateDeliveryOrder}
        onOpenChange={setShowCreateDeliveryOrder}
        salesOrderId={selectedSalesOrder?.id}
      />

      <DeliveryOrderDetailsDialog
        open={showDeliveryOrderDetails}
        onOpenChange={setShowDeliveryOrderDetails}
        deliveryOrderId={selectedDeliveryOrder || undefined}
      />

      {selectedSalesOrderId && (
        <SalesOrderDetailsDialog
          open={showSalesOrderDetails}
          onOpenChange={setShowSalesOrderDetails}
          salesOrderId={selectedSalesOrderId}
        />
      )}

      {selectedIssueId && (
        <FinishedGoodsIssueDetailsDialog
          open={showIssueDetails}
          onOpenChange={setShowIssueDetails}
          issueId={selectedIssueId}
        />
      )}

      {viewItemsForOrder && (
        <Card className="mt-4 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Sales Order Items</h3>
            <Button variant="outline" onClick={() => setViewItemsForOrder(null)}>
              Close
            </Button>
          </div>
          <SalesOrderItemsView salesOrderId={viewItemsForOrder} />
        </Card>
      )}
    </div>
  );
}