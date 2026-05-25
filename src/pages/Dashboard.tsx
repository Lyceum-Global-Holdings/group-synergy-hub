import { useState } from "react";
import {
  MapPin,
  HardHat,
  Wrench,
  Boxes,
  Users,
  Loader2,
  Activity,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboardLocations } from "@/hooks/useWarehouseLocations";
import { useDashboardLocationData } from "@/hooks/useDashboardLocationData";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useIsAdminOrHigher } from "@/hooks/useIsAdminOrHigher";
import { useDashboardRealtime, useHealthStrip } from "@/hooks/useDashboardPulse";
import { HealthStrip } from "@/components/dashboard/HealthStrip";
import { LivePulseIndicator } from "@/components/dashboard/LivePulseIndicator";
import { WarehousePillar } from "@/components/dashboard/WarehousePillar";
import { ProcurementPillar } from "@/components/dashboard/ProcurementPillar";
import { SourcingPillar } from "@/components/dashboard/SourcingPillar";
import { FinancePillar } from "@/components/dashboard/FinancePillar";

export default function Dashboard() {
  const { globalLocationId, setGlobalLocationId } = useLocationFilter();
  const { selectedCompany } = useCompany();
  const { canDelete: isAdminOrHigher } = useIsAdminOrHigher();
  const [locationFilter, setLocationFilter] = useState<string>(globalLocationId || "all");
  const { data: locations, isLoading: locationsLoading, isError: locationsError } = useDashboardLocations(selectedCompany?.id);
  const activeLocationId = locationFilter === "all" ? null : locationFilter;
  const companyId = selectedCompany?.id ?? null;

  const { inventory, labour, isLoading: locationDataLoading } = useDashboardLocationData(activeLocationId);
  const { live } = useDashboardRealtime();
  const { data: health, isLoading: healthLoading } = useHealthStrip(companyId, activeLocationId);

  const selectedLocationName =
    locationFilter === "all"
      ? "All Locations"
      : locations?.find((l) => l.id === locationFilter)?.name || "Selected Location";

  const handleLocationChange = (value: string) => {
    setLocationFilter(value);
    setGlobalLocationId(value === "all" ? null : value);
  };

  let locationPlaceholder = "All Locations";
  if (!selectedCompany?.id) locationPlaceholder = "Select a company";
  else if (locationsLoading) locationPlaceholder = "Loading locations…";
  else if (locationsError) locationPlaceholder = "Failed to load locations";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            Operations Pulse
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Realtime view of warehouse, procurement, sourcing and finance.
          </p>
        </div>
        <LivePulseIndicator live={live} />
      </div>

      {/* Location Filter */}
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
        <MapPin className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Location:</span>
        <Select
          value={locationFilter}
          onValueChange={handleLocationChange}
          disabled={locationsLoading || !selectedCompany?.id}
        >
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder={locationPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locationsError && (
              <SelectItem value="__error" disabled>
                Failed to load locations
              </SelectItem>
            )}
            {!locationsError && !locationsLoading && (locations?.length ?? 0) === 0 && selectedCompany?.id && (
              <SelectItem value="__empty" disabled>
                No locations mapped to this company
              </SelectItem>
            )}
            {locations && locations.length > 0 && locations.map(loc => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.parent_id ? `↳ ${loc.name}` : loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Health Strip */}
      <HealthStrip data={health} loading={healthLoading} />

      {/* Domain Pillars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WarehousePillar companyId={companyId} locationId={activeLocationId} />
        <ProcurementPillar companyId={companyId} />
        <SourcingPillar companyId={companyId} />
        {isAdminOrHigher && <FinancePillar companyId={companyId} />}
      </div>

      {/* Construction Module - Location Filtered */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <HardHat className="h-5 w-5 text-primary" />
          Construction — {selectedLocationName}
        </h2>

        {locationDataLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Serial-Tracked Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inventory?.serialCount ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Machines / Equipment with serials</p>
                {inventory?.conditionBreakdown && Object.keys(inventory.conditionBreakdown).length > 0 && (
                  <div className="mt-3 space-y-1">
                    {Object.entries(inventory.conditionBreakdown).map(([condition, count]) => (
                      <div key={condition} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{condition}</span>
                        <Badge variant="outline" className="text-xs h-5">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Boxes className="h-4 w-4" />
                  Bulk Stock Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inventory?.bulkItemCount ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total qty: {inventory?.totalBulkQty ?? 0} units
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Total Labour
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{labour?.totalLabour ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {labour?.activeLabour ?? 0} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <HardHat className="h-4 w-4" />
                  Labour by Trade
                </CardTitle>
              </CardHeader>
              <CardContent>
                {labour?.tradeBreakdown && Object.keys(labour.tradeBreakdown).length > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(labour.tradeBreakdown).map(([trade, count]) => (
                      <div key={trade} className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate mr-2">{trade}</span>
                        <Badge variant="outline" className="text-xs h-5 shrink-0">{count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No labour data</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
