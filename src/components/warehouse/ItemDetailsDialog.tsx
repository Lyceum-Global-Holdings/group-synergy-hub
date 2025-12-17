import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WarehouseItem } from "@/types/itemBin";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useItemUnits } from "@/hooks/useItemUnits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Package, DollarSign, Info, Grid3X3, CheckCircle, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

const fetchBinAllocations = async (itemId: string): Promise<BinAllocation[]> => {
  const { data, error } = await (supabase as any)
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
    .eq('item_id', itemId);
  
  if (error) throw error;
  return (data || []) as BinAllocation[];
};

export const ItemDetailsDialog = ({ item, open, onOpenChange }: ItemDetailsDialogProps) => {
  const { categories } = useItemCategories();
  const { units } = useItemUnits();

  const categoryName = categories.find(c => c.id === item?.category_id)?.name || "-";
  const unitName = units.find(u => u.id === item?.unit_id)?.name || "-";

  const { data: binAllocations } = useQuery<BinAllocation[]>({
    queryKey: ['bin-allocations', item?.id],
    queryFn: () => fetchBinAllocations(item!.id),
    enabled: !!item?.id && open,
  });

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
