import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Package, AlertTriangle, CheckCircle, ArrowRight, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFinishedGoods } from '@/hooks/useFinishedGoods';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function DemandOverviewTab() {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const { products } = useFinishedGoods(selectedCompany?.id);
  
  // Fetch sales orders with items
  const { data: salesOrdersData, isLoading: loadingSalesOrders } = useQuery({
    queryKey: ['sales-orders-with-items', selectedCompany?.id],
    queryFn: async () => {
      const { data: orders, error: ordersError } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('company_id', selectedCompany?.id)
        .in('status', ['confirmed', 'picking', 'picked'])
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch items for all orders
      const { data: items, error: itemsError } = await supabase
        .from('sales_order_items')
        .select('*')
        .in('sales_order_id', orders?.map(o => o.id) || []);

      if (itemsError) throw itemsError;

      // Combine orders with their items
      return orders?.map(order => ({
        ...order,
        items: items?.filter(item => item.sales_order_id === order.id) || []
      })) || [];
    },
    enabled: !!selectedCompany?.id
  });

  const pendingSalesOrders = salesOrdersData || [];

  const productsWithDemand = products?.map(product => {
    const relatedOrders = pendingSalesOrders.filter(order => 
      order.items?.some((item: any) => item.finished_good_id === product.id)
    );
    
    const totalDemand = relatedOrders.reduce((sum, order) => {
      const items = order.items?.filter((item: any) => 
        item.finished_good_id === product.id
      ) || [];
      return sum + items.reduce((itemSum: number, item: any) => 
        itemSum + (item.quantity_ordered - (item.quantity_picked || 0)), 0
      );
    }, 0);

    const nextDeliveryDate = relatedOrders
      .filter(order => order.required_date)
      .sort((a, b) => new Date(a.required_date!).getTime() - new Date(b.required_date!).getTime())[0]?.required_date;

    return {
      ...product,
      totalDemand,
      ordersCount: relatedOrders.length,
      nextDeliveryDate,
      stockSufficiency: totalDemand > 0 ? (product.available_stock || 0) / totalDemand : null
    };
  }).filter(p => p.totalDemand > 0) || [];

  const handleViewOrders = () => {
    navigate('/warehouse/pick-pack');
  };

  const getStockStatus = (stockSufficiency: number | null, available: number, demand: number) => {
    if (stockSufficiency === null || demand === 0) {
      return { variant: 'outline' as const, label: 'No Demand', icon: Package };
    }
    if (available >= demand) {
      return { variant: 'default' as const, label: 'Sufficient', icon: CheckCircle };
    }
    if (available > 0) {
      return { variant: 'secondary' as const, label: 'Partial', icon: AlertTriangle };
    }
    return { variant: 'destructive' as const, label: 'Out of Stock', icon: AlertTriangle };
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products in Demand</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productsWithDemand.length}</div>
            <p className="text-xs text-muted-foreground">
              {products?.length || 0} total products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Sales Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingSalesOrders.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting fulfillment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {productsWithDemand.filter(p => (p.available_stock || 0) < p.totalDemand).length}
            </div>
            <p className="text-xs text-muted-foreground">Products below demand</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Ready to Fulfill Orders?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Go to Pick, Pack & Dispatch to start fulfillment operations
              </p>
            </div>
            <Button onClick={handleViewOrders} size="lg">
              Start Fulfillment
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products with Demand Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products with Pending Demand</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSalesOrders ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading demand data...</div>
            </div>
          ) : productsWithDemand.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Pending Demand</TableHead>
                  <TableHead>Available Stock</TableHead>
                  <TableHead>Stock Status</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Next Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsWithDemand.map((product) => {
                  const status = getStockStatus(
                    product.stockSufficiency, 
                    product.available_stock || 0, 
                    product.totalDemand
                  );
                  const StatusIcon = status.icon;

                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.product_name}</TableCell>
                      <TableCell>{product.product_code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          {product.totalDemand}
                        </div>
                      </TableCell>
                      <TableCell>{product.available_stock || 0}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.ordersCount} orders</Badge>
                      </TableCell>
                      <TableCell>
                        {product.nextDeliveryDate ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(product.nextDeliveryDate), 'MMM dd, yyyy')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pending Demand</h3>
              <p className="text-muted-foreground">
                All sales orders have been fulfilled or there are no active orders
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
