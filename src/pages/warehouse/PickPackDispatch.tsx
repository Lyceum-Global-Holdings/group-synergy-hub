import { SalesOrderFulfillmentTab } from "@/components/warehouse/SalesOrderFulfillmentTab";

export default function PickPackDispatch() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pick Pack & Dispatch</h1>
          <p className="text-muted-foreground mt-1">
            Manage sales order fulfillment, picking, packing, and dispatch operations
          </p>
        </div>
      </div>
      
      <SalesOrderFulfillmentTab />
    </div>
  );
}