import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Package, AlertCircle } from "lucide-react";
import { usePickPack } from "@/hooks/usePickPack";
import { FinishedGoodsIssueDialog } from "./FinishedGoodsIssueDialog";

interface SalesOrderItemsViewProps {
  salesOrderId: string;
}

export function SalesOrderItemsView({ salesOrderId }: SalesOrderItemsViewProps) {
  const { useSalesOrderItems } = usePickPack();
  const { data: items, isLoading } = useSalesOrderItems(salesOrderId);
  const [showIssueDialog, setShowIssueDialog] = useState(false);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      pending: "secondary",
      partial: "outline",
      issued: "default",
      picked: "default",
      packed: "default",
      dispatched: "default"
    };
    
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const calculateProgress = (item: any) => {
    if (!item.quantity_ordered) return 0;
    return (item.quantity_issued / item.quantity_ordered) * 100;
  };

  const getStockStatus = (item: any) => {
    if (!item.finished_goods) return null;
    const available = item.finished_goods.current_stock || 0;
    const required = item.quantity_ordered - item.quantity_issued;
    
    if (available >= required) {
      return <Badge variant="default" className="bg-success">In Stock</Badge>;
    } else if (available > 0) {
      return <Badge variant="outline" className="border-warning text-warning">Low Stock</Badge>;
    } else {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading items...</div>;
  }

  if (!items?.length) {
    return (
      <Card className="p-8 text-center">
        <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No items in this sales order</p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Sales Order Items</h3>
          <Button onClick={() => setShowIssueDialog(true)}>
            <Package className="w-4 h-4 mr-2" />
            Issue from Warehouse
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((item: any) => (
            <Card key={item.id} className="p-4">
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-3">
                  <div className="font-medium">{item.item_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.finished_goods?.product_code}
                  </div>
                </div>

                <div className="col-span-2 text-center">
                  <div className="text-sm text-muted-foreground">Ordered</div>
                  <div className="font-semibold">{item.quantity_ordered}</div>
                </div>

                <div className="col-span-2 text-center">
                  <div className="text-sm text-muted-foreground">Issued</div>
                  <div className="font-semibold">{item.quantity_issued}</div>
                </div>

                <div className="col-span-2 text-center">
                  <div className="text-sm text-muted-foreground">Remaining</div>
                  <div className="font-semibold text-warning">
                    {item.quantity_ordered - item.quantity_issued}
                  </div>
                </div>

                <div className="col-span-2">
                  {getStockStatus(item)}
                  {item.finished_goods && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Stock: {item.finished_goods.current_stock}
                    </div>
                  )}
                </div>

                <div className="col-span-1 text-right">
                  {getStatusBadge(item.status)}
                </div>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Fulfillment Progress</span>
                  <span>{Math.round(calculateProgress(item))}%</span>
                </div>
                <Progress value={calculateProgress(item)} className="h-2" />
              </div>

              {item.quantity_ordered - item.quantity_issued > 0 && 
               (!item.finished_goods || item.finished_goods.current_stock < (item.quantity_ordered - item.quantity_issued)) && (
                <div className="mt-2 flex items-center gap-2 text-sm text-warning">
                  <AlertCircle className="w-4 h-4" />
                  <span>Insufficient stock to fulfill remaining quantity</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {showIssueDialog && (
        <FinishedGoodsIssueDialog
          open={showIssueDialog}
          onOpenChange={setShowIssueDialog}
          salesOrderId={salesOrderId}
          salesOrderItems={items}
        />
      )}
    </>
  );
}
