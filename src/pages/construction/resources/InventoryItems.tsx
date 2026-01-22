import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, Boxes, MapPin, ArrowRightLeft, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AllocationDashboard,
  InventoryWiseView,
  LocationWiseView,
  TransfersView,
  ServiceRepairView,
  ItemMasterSubTabs,
} from "@/components/construction/inventory";

// Allocation sub-tabs
const ALLOCATION_TABS = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "inventory-wise", label: "Inventory Wise", icon: Boxes },
  { value: "location-wise", label: "Location Wise", icon: MapPin },
  { value: "transfers", label: "Transfers", icon: ArrowRightLeft },
  { value: "service-repair", label: "Service & Repair", icon: Wrench },
];

export default function InventoryItems() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("allocation");
  const [allocationSubTab, setAllocationSubTab] = useState("dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/construction/resource-allocation")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Items</h1>
          <p className="text-muted-foreground">
            Manage inventory allocations and item master
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="allocation">Allocation View</TabsTrigger>
          <TabsTrigger value="master">Item Master</TabsTrigger>
        </TabsList>

        <TabsContent value="allocation" className="space-y-4">
          {/* Allocation Sub-Tabs */}
          <div className="border-b">
            <div className="flex gap-1">
              {ALLOCATION_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setAllocationSubTab(tab.value)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      allocationSubTab === tab.value
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allocation Sub-Tab Content */}
          {allocationSubTab === "dashboard" && <AllocationDashboard />}
          {allocationSubTab === "inventory-wise" && <InventoryWiseView />}
          {allocationSubTab === "location-wise" && <LocationWiseView />}
          {allocationSubTab === "transfers" && <TransfersView />}
          {allocationSubTab === "service-repair" && <ServiceRepairView />}
        </TabsContent>

        <TabsContent value="master" className="space-y-4">
          {/* Item Master with 6 sub-tabs */}
          <ItemMasterSubTabs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
