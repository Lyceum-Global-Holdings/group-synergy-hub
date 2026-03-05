import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, Boxes, MapPin, ArrowRightLeft, Wrench, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AllocationDashboard,
  InventoryWiseView,
  LocationWiseView,
  TransfersView,
  ServiceRepairView,
  ItemMasterView,
} from "@/components/construction/inventory";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useLocations } from "@/hooks/construction/useConstructionInventory";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const { globalLocationId, setGlobalLocationId } = useLocationFilter();
  const { selectedCompany } = useCompany();

  // Fetch locations mapped to the selected company
  const { data: locations } = useQuery({
    queryKey: ["inventory-page-locations", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const [{ data: mappedRows }, { data: legacyRows }] = await Promise.all([
        supabase
          .from("warehouse_location_companies")
          .select("warehouse_locations!inner(id, name, type)")
          .eq("company_id", selectedCompany.id)
          .eq("warehouse_locations.type", "location"),
        supabase
          .from("warehouse_locations")
          .select("id, name, type")
          .eq("company_id", selectedCompany.id)
          .eq("type", "location"),
      ]);

      const merged = new Map<string, { id: string; name: string }>();
      (mappedRows || []).forEach((row: any) => {
        const loc = row.warehouse_locations;
        if (loc?.id) merged.set(loc.id, { id: loc.id, name: loc.name });
      });
      (legacyRows || []).forEach((loc: any) => {
        if (loc?.id) merged.set(loc.id, { id: loc.id, name: loc.name });
      });

      return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!selectedCompany?.id,
  });

  const locationFilterValue = globalLocationId || "all";
  const selectedLocationName = globalLocationId
    ? locations?.find((l) => l.id === globalLocationId)?.name
    : null;

  const handleLocationChange = (value: string) => {
    setGlobalLocationId(value === "all" ? null : value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/construction/resource-allocation")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Inventory Items</h1>
          <p className="text-muted-foreground">
            Inventory Allocation & Tracking System
          </p>
        </div>
      </div>

      {/* Location Filter Bar */}
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
        <MapPin className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Location:</span>
        <Select value={locationFilterValue} onValueChange={handleLocationChange}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations?.map(loc => (
              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedLocationName && (
          <Badge variant="secondary" className="ml-2">
            Filtering: {selectedLocationName}
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="allocation" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Allocation View
          </TabsTrigger>
          <TabsTrigger value="master" className="gap-2">
            <Package className="h-4 w-4" />
            Item Master
          </TabsTrigger>
        </TabsList>

        <TabsContent value="allocation" className="space-y-4">
          {/* Allocation Sub-Tabs */}
          <div className="border-b">
            <div className="flex gap-1 overflow-x-auto">
              {ALLOCATION_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setAllocationSubTab(tab.value)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
          <ItemMasterView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
