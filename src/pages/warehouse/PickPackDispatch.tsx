import { SalesOrderFulfillmentTab } from "@/components/warehouse/SalesOrderFulfillmentTab";
import { Button } from "@/components/ui/button";
import { Package, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PickPackDispatch() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pick Pack & Dispatch</h1>
          <p className="text-muted-foreground mt-1">
            Manage sales order fulfillment, picking, packing, and dispatch operations
          </p>
        </div>
        <Button onClick={() => navigate('/tuh-modules/finished-goods')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Manage Inventory
          <Package className="h-4 w-4 ml-2" />
        </Button>
      </div>
      
      <SalesOrderFulfillmentTab />
    </div>
  );
}