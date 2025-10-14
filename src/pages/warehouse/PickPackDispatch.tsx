import { useState } from "react";
import { SalesOrderFulfillmentTab } from "@/components/warehouse/SalesOrderFulfillmentTab";
import { ResetSalesOrdersDialog } from "@/components/warehouse/ResetSalesOrdersDialog";
import { Button } from "@/components/ui/button";
import { Package, ArrowLeft, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePickPack } from "@/hooks/usePickPack";
import { supabase } from "@/integrations/supabase/client";

export default function PickPackDispatch() {
  const navigate = useNavigate();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetCounts, setResetCounts] = useState({
    salesOrders: 0,
    salesOrderItems: 0,
    finishedGoodsIssues: 0,
    pickLists: 0,
    deliveryOrders: 0,
  });
  
  const { 
    useSalesOrders,
    usePickLists,
    useFinishedGoodsIssues,
    resetSalesOrdersModule, 
    isResettingModule 
  } = usePickPack();

  const { data: salesOrders } = useSalesOrders();
  const { data: pickLists } = usePickLists();
  const { data: finishedGoodsIssues } = useFinishedGoodsIssues();

  // Calculate counts when opening dialog
  const handleOpenResetDialog = async () => {
    const { count: soItemsCount } = await supabase
      .from('sales_order_items')
      .select('*', { count: 'exact', head: true });
    
    const { count: deliveryOrdersCount } = await supabase
      .from('delivery_orders')
      .select('*', { count: 'exact', head: true });

    setResetCounts({
      salesOrders: salesOrders?.length || 0,
      salesOrderItems: soItemsCount || 0,
      finishedGoodsIssues: finishedGoodsIssues?.length || 0,
      pickLists: pickLists?.length || 0,
      deliveryOrders: deliveryOrdersCount || 0,
    });
    setShowResetDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pick Pack & Dispatch</h1>
          <p className="text-muted-foreground mt-1">
            Manage sales order fulfillment, picking, packing, and dispatch operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleOpenResetDialog} 
            variant="destructive"
            size="sm"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Module
          </Button>
          <Button onClick={() => navigate('/tuh-modules/finished-goods')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Manage Inventory
            <Package className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
      
      <SalesOrderFulfillmentTab />

      <ResetSalesOrdersDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        onConfirm={() => {
          resetSalesOrdersModule();
          setShowResetDialog(false);
        }}
        isResetting={isResettingModule}
        counts={resetCounts}
      />
    </div>
  );
}