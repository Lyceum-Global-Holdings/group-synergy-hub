import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WarehouseItem } from "@/types/itemBin";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useItemUnits } from "@/hooks/useItemUnits";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfDay } from "date-fns";
import { Package, DollarSign, Info, Grid3X3, CheckCircle, XCircle, TrendingUp, History } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

interface ItemDetailsDialogProps {
  item: WarehouseItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BinAllocation {
  id: string;
  allocated_quantity: number;
  warehouse_bins: {
    id: string;
    bin_code: string;
    name: string;
    status: string;
  } | null;
}

interface StockTransaction {
  id: string;
  transaction_type: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  notes: string | null;
  created_at: string;
}

const fetchBinAllocations = async (itemId: string): Promise<BinAllocation[]> => {
  const { data, error } = await supabase
    .from('warehouse_bin_allocations')
    .select(`
      id,
      allocated_quantity,
      warehouse_bins (
        id,
        bin_code,
        name,
        status
      )
    `)
    .eq('warehouse_item_id', itemId);
  
  if (error) throw error;
  return (data || []) as BinAllocation[];
};

const fetchStockTransactions = async (
  itemId: string,
  locationId: string | null | undefined,
): Promise<StockTransaction[]> => {
  // Bin-scoped RPC: same item at a different bin/location is a distinct SKU
  // and must NOT pollute this item's history. Quantities are bin-level.
  const { data, error } = await supabase.rpc('get_bin_scoped_stock_movements', {
    p_item_id: itemId,
    p_location_id: locationId ?? null,
    p_bin_id: null,
  });
  if (error) throw error;
  return ((data || []) as any[]).slice(0, 100).map((r) => ({
    id: r.id,
    transaction_type: r.transaction_type,
    quantity_change: Number(r.quantity_change),
    quantity_before: Number(r.quantity_before),
    quantity_after: Number(r.quantity_after),
    notes: r.notes,
    created_at: r.created_at,
  })) as StockTransaction[];
};

export const ItemDetailsDialog = ({ item, open, onOpenChange }: ItemDetailsDialogProps) => {
  const { categories } = useItemCategories();
  const { units } = useItemUnits();
  const { locations } = useWarehouseLocations();

  const categoryName = categories.find(c => c.id === item?.category_id)?.name || "-";
  const unitName = units.find(u => u.id === item?.unit_id)?.name || "-";
  const warehouseLocation = locations.find(l => l.id === item?.location_id);

  const { data: binAllocations } = useQuery<BinAllocation[]>({
    queryKey: ['bin-allocations', item?.id],
    queryFn: () => fetchBinAllocations(item!.id),
    enabled: !!item?.id && open,
  });

  const { data: stockTransactions = [] } = useQuery<StockTransaction[]>({
    queryKey: ['stock-transactions', item?.id, item?.location_id ?? null],
    queryFn: () => fetchStockTransactions(item!.id, item?.location_id ?? null),
    enabled: !!item?.id && open,
  });

  // Aggregate transactions by day for chart
  const dailyStockData = useMemo(() => {
    if (!stockTransactions.length) return [];

    // Group by day and get the last quantity_after for each day
    const dayMap = new Map<string, { date: string; quantity: number; changes: number }>();
    
    // Process in reverse chronological order (oldest first for the chart)
    const sorted = [...stockTransactions].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sorted.forEach((txn) => {
      const dayKey = format(parseISO(txn.created_at), 'yyyy-MM-dd');
      const existing = dayMap.get(dayKey);
      
      if (existing) {
        existing.quantity = txn.quantity_after;
        existing.changes += txn.quantity_change;
      } else {
        dayMap.set(dayKey, {
          date: format(parseISO(txn.created_at), 'MMM dd'),
          quantity: txn.quantity_after,
          changes: txn.quantity_change,
        });
      }
    });

    return Array.from(dayMap.values());
  }, [stockTransactions]);

  const getStockStatus = () => {
    if (!item) return { label: "-", variant: "secondary" as const };
    const stock = item.current_stock || 0;
    const reorder = item.reorder_level || 0;
    const min = item.min_stock_level || 0;

    if (stock <= 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (stock <= min) return { label: "Critical", variant: "destructive" as const };
    if (stock <= reorder) return { label: "Low Stock", variant: "outline" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  const stockStatus = getStockStatus();

  const calculateMargin = () => {
    if (!item?.unit_cost || !item?.selling_price) return null;
    const margin = ((item.selling_price - item.unit_cost) / item.unit_cost) * 100;
    return margin.toFixed(1);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Item Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {item.image_url && (
                  <div className="flex-shrink-0">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-32 h-32 object-cover rounded-lg border"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 flex-1">
                  <div>
                    <p className="text-xs text-muted-foreground">Item Code</p>
                    <p className="font-medium">{item.item_code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">{item.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="font-medium">{categoryName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Unit</p>
                    <p className="font-medium">{unitName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Brand</p>
                    <p className="font-medium">{item.brand || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Manufacturer</p>
                    <p className="font-medium">{item.manufacturer || "-"}</p>
                  </div>
                </div>
              </div>
              
              {item.description && (
                <>
                  <Separator className="my-3" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{item.description}</p>
                  </div>
                </>
              )}

              <div className="flex gap-2 mt-3">
                <Badge variant={item.is_serialized ? "default" : "outline"} className="flex items-center gap-1">
                  {item.is_serialized ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  Serialized
                </Badge>
                <Badge variant={item.is_batch_tracked ? "default" : "outline"} className="flex items-center gap-1">
                  {item.is_batch_tracked ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  Batch Tracked
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Stock Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Stock Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Current Stock</p>
                  <p className="text-2xl font-bold">{item.current_stock || 0}</p>
                  <Badge variant={stockStatus.variant} className="mt-1">
                    {stockStatus.label}
                  </Badge>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Reorder Level</p>
                  <p className="text-2xl font-bold">{item.reorder_level || 0}</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Min Stock</p>
                  <p className="text-2xl font-bold">{item.min_stock_level || 0}</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Max Stock</p>
                  <p className="text-2xl font-bold">{item.max_stock_level || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Unit Cost</p>
                  <p className="text-xl font-bold">
                    {item.unit_cost ? `LKR ${item.unit_cost.toFixed(2)}` : "-"}
                  </p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Selling Price</p>
                  <p className="text-xl font-bold">
                    {item.selling_price ? `LKR ${item.selling_price.toFixed(2)}` : "-"}
                  </p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Margin</p>
                  <p className="text-xl font-bold">
                    {calculateMargin() ? `${calculateMargin()}%` : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Price History */}
          <PurchasePriceHistory
            catalogItemId={(item as any).catalog_item_id ?? null}
            warehouseItemId={item.id}
          />


          {/* Additional Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                Additional Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Barcode</p>
                  <p className="font-medium">{item.barcode || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">SKU</p>
                  <p className="font-medium">{item.sku || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Warehouse</p>
                  <p className="font-medium">
                    {warehouseLocation 
                      ? `${warehouseLocation.name}${warehouseLocation.location_code ? ` (${warehouseLocation.location_code})` : ''}`
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                    {item.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {item.created_at ? format(new Date(item.created_at), 'MMM dd, yyyy') : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Updated</p>
                  <p className="font-medium">
                    {item.updated_at ? format(new Date(item.updated_at), 'MMM dd, yyyy') : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {item.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Bin Allocations */}
          {binAllocations && binAllocations.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Bin Allocations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bin Code</TableHead>
                      <TableHead>Bin Name</TableHead>
                      <TableHead className="text-right">Allocated Qty</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {binAllocations.map((allocation) => (
                      <TableRow key={allocation.id}>
                        <TableCell className="font-medium">
                          {allocation.warehouse_bins?.bin_code || "-"}
                        </TableCell>
                        <TableCell>{allocation.warehouse_bins?.name || "-"}</TableCell>
                        <TableCell className="text-right">{allocation.allocated_quantity}</TableCell>
                        <TableCell>
                          <Badge variant={allocation.warehouse_bins?.status === 'active' ? 'default' : 'secondary'}>
                            {allocation.warehouse_bins?.status || "-"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Daily Stock Movement Chart */}
          {dailyStockData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Daily Stock Movement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyStockData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }} 
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                      labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="quantity" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                      name="Stock Level"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Stock Transaction History */}
          {stockTransactions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Stock Transaction History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                        <TableHead className="text-right">After</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockTransactions.slice(0, 20).map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(parseISO(txn.created_at), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {txn.transaction_type.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${
                            txn.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {txn.quantity_change > 0 ? '+' : ''}{txn.quantity_change}
                          </TableCell>
                          <TableCell className="text-right">{txn.quantity_after}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">
                            {txn.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {stockTransactions.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Showing 20 of {stockTransactions.length} transactions
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
