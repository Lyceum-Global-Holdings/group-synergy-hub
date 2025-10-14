import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Filter, Edit, Trash2, Package, TrendingUp, TrendingDown, History, Settings, ShoppingCart, AlertTriangle, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFinishedGoods } from '@/hooks/useFinishedGoods';
import { CreateFinishedGoodDialog } from './CreateFinishedGoodDialog';
import { EditFinishedGoodDialog } from './EditFinishedGoodDialog';
import { FinishedGoodsMovementDialog } from './FinishedGoodsMovementDialog';
import { FinishedGoodsStockAdjustmentDialog } from './FinishedGoodsStockAdjustmentDialog';
import { ViewRelatedOrdersDialog } from './ViewRelatedOrdersDialog';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';

export function FinishedGoodsMasterTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [movementDialogProduct, setMovementDialogProduct] = useState<{id: string, name: string, stock: number} | null>(null);
  const [adjustmentDialogProduct, setAdjustmentDialogProduct] = useState<{id: string, name: string, stock: number} | null>(null);
  const [viewOrdersProduct, setViewOrdersProduct] = useState<{id: string, name: string} | null>(null);
  const { selectedCompany } = useCompany();
  const { products, isLoading, error, deleteProduct, isDeleting } = useFinishedGoods(selectedCompany?.id);
  const { toast } = useToast();

  // Fetch demand data for all products
  const { data: demandData } = useQuery({
    queryKey: ['product-demand', selectedCompany?.id],
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from('sales_order_items')
        .select(`
          *,
          sales_orders!inner (
            id,
            status,
            required_date,
            priority
          )
        `)
        .in('sales_orders.status', ['confirmed', 'picking', 'picked', 'packing', 'packed']);

      if (error) throw error;

      // Group by finished_good_id
      const demandMap = new Map();
      items?.forEach((item: any) => {
        const fgId = item.finished_good_id;
        if (!fgId) return;

        const pendingQty = item.quantity_ordered - (item.quantity_picked || 0);
        if (pendingQty <= 0) return;

        if (!demandMap.has(fgId)) {
          demandMap.set(fgId, {
            totalDemand: 0,
            ordersCount: new Set(),
            nextDeliveryDate: null,
            reservedStock: 0
          });
        }

        const demand = demandMap.get(fgId);
        demand.totalDemand += pendingQty;
        demand.reservedStock += Math.min(pendingQty, item.quantity_issued || 0);
        demand.ordersCount.add(item.sales_orders.id);
        
        if (item.sales_orders.required_date) {
          const date = new Date(item.sales_orders.required_date);
          if (!demand.nextDeliveryDate || date < demand.nextDeliveryDate) {
            demand.nextDeliveryDate = date;
          }
        }
      });

      // Convert Set to count
      demandMap.forEach((value, key) => {
        value.ordersCount = value.ordersCount.size;
      });

      return demandMap;
    },
    enabled: !!selectedCompany?.id
  });

  const filteredProducts = products?.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.style_no?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this finished good?')) {
      try {
        await deleteProduct(id);
      } catch (error) {
        console.error('Failed to delete product:', error);
      }
    }
  };

  const getStockStatusBadge = (product: any) => {
    const stock = product.current_stock || 0;
    const reorderPoint = product.reorder_point || 0;
    
    if (stock <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (stock <= reorderPoint) {
      return <Badge variant="secondary">Low Stock</Badge>;
    } else {
      return <Badge variant="default">In Stock</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load finished goods: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Finished Goods Master
            </CardTitle>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name, code, or style..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Style/Size/Color</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Demand</TableHead>
                  <TableHead>Stock Status</TableHead>
                  <TableHead>Next Delivery</TableHead>
                  <TableHead>Selling Price</TableHead>
                  <TableHead>Stock Actions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No finished goods found. {searchTerm ? 'Try adjusting your search.' : 'Add your first product to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const demand = demandData?.get(product.id);
                    const availableStock = (product.current_stock || 0) - (demand?.reservedStock || 0);
                    const hasInsufficientStock = demand && availableStock < demand.totalDemand;

                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.product_code}</TableCell>
                        <TableCell>{product.product_name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {product.style_no && <div>Style: {product.style_no}</div>}
                            {product.size && <div>Size: {product.size}</div>}
                            {product.color && <div>Color: {product.color}</div>}
                          </div>
                        </TableCell>
                        <TableCell>{product.category || '-'}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{product.current_stock || 0} {product.unit_of_measure}</span>
                              {(product.current_stock || 0) > (product.reorder_point || 0) ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                            {demand && demand.reservedStock > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Reserved: {demand.reservedStock}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {demand ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{demand.totalDemand}</span>
                              </div>
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs"
                                onClick={() => setViewOrdersProduct({id: product.id, name: product.product_name})}
                              >
                                {demand.ordersCount} {demand.ordersCount === 1 ? 'order' : 'orders'}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getStockStatusBadge(product)}
                            {hasInsufficientStock && (
                              <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                <AlertTriangle className="h-3 w-3" />
                                Below Demand
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {demand?.nextDeliveryDate ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{format(demand.nextDeliveryDate, 'MMM dd')}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{product.selling_price ? `LKR ${product.selling_price.toFixed(2)}` : '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMovementDialogProduct({id: product.id, name: product.product_name, stock: product.current_stock})}
                              title="View stock movement history"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost" 
                              size="sm"
                              onClick={() => setAdjustmentDialogProduct({id: product.id, name: product.product_name, stock: product.current_stock})}
                              title="Adjust stock"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingProduct(product.id)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(product.id)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateFinishedGoodDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {editingProduct && (
        <EditFinishedGoodDialog
          productId={editingProduct}
          open={true}
          onOpenChange={(open) => !open && setEditingProduct(null)}
        />
      )}

      {movementDialogProduct && (
        <FinishedGoodsMovementDialog
          open={!!movementDialogProduct}
          onOpenChange={(open) => !open && setMovementDialogProduct(null)}
          finishedGoodId={movementDialogProduct.id}
          productName={movementDialogProduct.name}
          currentStock={movementDialogProduct.stock}
        />
      )}

      {adjustmentDialogProduct && (
        <FinishedGoodsStockAdjustmentDialog
          open={!!adjustmentDialogProduct}
          onOpenChange={(open) => !open && setAdjustmentDialogProduct(null)}
          finishedGoodId={adjustmentDialogProduct.id}
          productName={adjustmentDialogProduct.name}
          currentStock={adjustmentDialogProduct.stock}
        />
      )}

      {viewOrdersProduct && (
        <ViewRelatedOrdersDialog
          open={!!viewOrdersProduct}
          onOpenChange={(open) => !open && setViewOrdersProduct(null)}
          finishedGoodId={viewOrdersProduct.id}
          productName={viewOrdersProduct.name}
        />
      )}
    </>
  );
}