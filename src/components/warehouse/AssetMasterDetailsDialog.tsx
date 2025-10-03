import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AssetMaster } from "@/types/assetMaster";
import { useAssetMasterPurchaseHistory } from "@/hooks/useAssetMasterPurchaseHistory";
import { useAssetCategories } from "@/hooks/useAssetCategories";
import { Plus, Edit } from "lucide-react";
import { AddPurchaseHistoryDialog } from "./AddPurchaseHistoryDialog";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface AssetMasterDetailsDialogProps {
  asset: AssetMaster;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssetMasterDetailsDialog({ asset, open, onOpenChange }: AssetMasterDetailsDialogProps) {
  const [isAddHistoryDialogOpen, setIsAddHistoryDialogOpen] = useState(false);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [inventoryByStatus, setInventoryByStatus] = useState<Record<string, number>>({});

  const { purchaseHistory, isLoading } = useAssetMasterPurchaseHistory(asset.id);
  const { categories } = useAssetCategories();

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'N/A';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'N/A';
  };

  useEffect(() => {
    const fetchInventoryData = async () => {
      // Get total count
      const { count } = await supabase
        .from('warehouse_assets')
        .select('*', { count: 'exact', head: true })
        .eq('asset_master_id', asset.id);

      setInventoryCount(count || 0);

      // Get breakdown by status
      const { data: statusData } = await supabase
        .from('warehouse_assets')
        .select('status')
        .eq('asset_master_id', asset.id);

      if (statusData) {
        const statusCounts: Record<string, number> = {};
        statusData.forEach((item) => {
          statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
        });
        setInventoryByStatus(statusCounts);
      }
    };

    if (open) {
      fetchInventoryData();
    }
  }, [asset.id, open]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asset Master Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-6">
                  {asset.image_url ? (
                    <img
                      src={asset.image_url}
                      alt={asset.asset_name}
                      className="h-32 w-32 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="h-32 w-32 bg-muted rounded-lg flex items-center justify-center">
                      No Image
                    </div>
                  )}
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Asset Name</p>
                      <p className="font-medium">{asset.asset_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Brand</p>
                      <p className="font-medium">{asset.brand || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Category</p>
                      <p className="font-medium">{getCategoryName(asset.category_id)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sub Category</p>
                      <p className="font-medium">{getCategoryName(asset.subcategory_id)}</p>
                    </div>
                  </div>
                </div>
                {asset.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="mt-1">{asset.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pricing Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Purchase Price</p>
                    <p className="text-xl font-bold">
                      {asset.purchase_price ? `LKR ${asset.purchase_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Value</p>
                    <p className="text-xl font-bold">
                      {asset.current_value ? `LKR ${asset.current_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Purchase Price History */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Purchase Price History</CardTitle>
                <Button size="sm" onClick={() => setIsAddHistoryDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add History
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : purchaseHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">No purchase history</TableCell>
                      </TableRow>
                    ) : (
                      purchaseHistory.map((history) => (
                        <TableRow key={history.id}>
                          <TableCell>{format(new Date(history.purchase_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="font-medium">LKR {history.purchase_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell>{history.vendor || 'N/A'}</TableCell>
                          <TableCell>{history.quantity_purchased || 'N/A'}</TableCell>
                          <TableCell>{history.notes || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Inventory Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inventory Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Items in Inventory</p>
                    <p className="text-2xl font-bold">{inventoryCount}</p>
                  </div>
                  {Object.keys(inventoryByStatus).length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Breakdown by Status</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(inventoryByStatus).map(([status, count]) => (
                          <div key={status} className="flex justify-between items-center p-2 bg-muted rounded">
                            <span className="text-sm capitalize">{status.replace('_', ' ')}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <AddPurchaseHistoryDialog
        assetMasterId={asset.id}
        open={isAddHistoryDialogOpen}
        onOpenChange={setIsAddHistoryDialogOpen}
      />
    </>
  );
}
