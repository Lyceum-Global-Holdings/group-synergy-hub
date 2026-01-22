import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Wrench, MapPin, ArrowRightLeft, LayoutDashboard, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ITEM_CATEGORIES, ITEM_SECTIONS } from "@/types/construction-inventory";

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
            Inventory Allocation & Tracking System
          </p>
        </div>
      </div>

      {/* Schema Ready Notice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Database Schema Ready
          </CardTitle>
          <CardDescription>
            The new inventory system structure has been created with the following tables:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-3">
              <h4 className="font-medium flex items-center gap-2">
                <Boxes className="h-4 w-4" /> Item Master
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Central registry for all items with category, section, and serial tracking flag
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <h4 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" /> Serial Numbers
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Individual tracking for machines with location, condition, and availability
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <h4 className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Stock Balances
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Quantity tracking per item per location for non-serial items
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <h4 className="font-medium flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" /> Transfers
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Transfer records with line items (quantity or serial number)
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <h4 className="font-medium flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Repair Records
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Service tracking with status, cost, and downtime
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <h4 className="font-medium flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" /> Transaction Log
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Full audit trail of all inventory movements
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories & Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Item Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {ITEM_CATEGORIES.map(cat => (
                <span key={cat.value} className="px-3 py-1 rounded-full bg-muted text-sm">
                  {cat.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Business Sections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {ITEM_SECTIONS.map(sec => (
                <span key={sec.value} className="px-3 py-1 rounded-full bg-muted text-sm">
                  {sec.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardHeader className="text-center">
          <CardTitle>Ready for UI Implementation</CardTitle>
          <CardDescription>
            Share your interface design or wireframes to build the 5 allocation views:
            Dashboard, Inventory-Wise, Location-Wise, Transfers, and Service & Repair.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
