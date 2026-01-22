import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function InventoryItems() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/construction/resource-allocation")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Items</h1>
          <p className="text-muted-foreground">
            Construction inventory management
          </p>
        </div>
      </div>

      <Card className="border-dashed">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Ready for New Structure</CardTitle>
          <CardDescription>
            All existing inventory data has been cleared. Share your new interface plan to rebuild this section.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Database tables cleared:</p>
          <ul className="mt-2 space-y-1">
            <li>• construction_inventory_master</li>
            <li>• construction_inventory_transactions</li>
            <li>• construction_repair_records</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
