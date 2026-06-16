import {
  HardHat,
  Wrench,
  Boxes,
  Users,
  Loader2,
  Activity,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { AnalyticsGrid } from "@/components/dashboard/AnalyticsGrid";

export default function Dashboard() {
  const { globalLocationId } = useLocationFilter();
  const { selectedCompany } = useCompany();
  const { canDelete: isAdminOrHigher } = useIsAdminOrHigher();
  const { data: locations } = useDashboardLocations(selectedCompany?.id);
  const activeLocationId = globalLocationId;
  const companyId = selectedCompany?.id ?? null;

  const { inventory, labour, isLoading: locationDataLoading } = useDashboardLocationData(activeLocationId);
  const { live } = useDashboardRealtime();
  const { data: health, isLoading: healthLoading } = useHealthStrip(companyId, activeLocationId);

  const selectedLocationName =
    globalLocationId === null
      ? "All Locations"
      : locations?.find((l) => l.id === globalLocationId)?.name || "Selected Location";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-sm)]">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Operations Pulse
            </h1>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              Real-time view of warehouse, procurement, sourcing and finance.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href="/scanner/" aria-label="Open Scanner app">
              <ScanLine className="h-4 w-4" />
              Open Scanner
            </a>
          </Button>
          <LivePulseIndicator live={live} />
        </div>
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

      {/* Material Flow Analytics */}
      <AnalyticsGrid companyId={companyId} locationId={activeLocationId} />



      {/* Construction Module - Location Filtered */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pt-2">
          <div className="h-px flex-1 bg-border" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
            <HardHat className="h-3.5 w-3.5 text-primary" />
            Construction · {selectedLocationName}
          </h2>
          <div className="h-px flex-1 bg-border" />
        </div>

        {locationDataLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <Wrench className="h-3.5 w-3.5 text-primary" />
                Serial-Tracked Assets
              </div>
              <div className="font-mono text-3xl font-extrabold tabular-nums mt-3">
                {inventory?.serialCount ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Machines / Equipment with serials</p>
              {inventory?.conditionBreakdown && Object.keys(inventory.conditionBreakdown).length > 0 && (
                <div className="mt-4 space-y-1.5 pt-3 border-t border-border-subtle">
                  {Object.entries(inventory.conditionBreakdown).map(([condition, count]) => (
                    <div key={condition} className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">{condition}</span>
                      <Badge variant="outline" className="text-[10px] h-5 font-mono tabular-nums">
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <Boxes className="h-3.5 w-3.5 text-info" />
                Bulk Stock Items
              </div>
              <div className="font-mono text-3xl font-extrabold tabular-nums mt-3">
                {inventory?.bulkItemCount ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total qty: <span className="font-mono font-semibold text-foreground">{inventory?.totalBulkQty ?? 0}</span> units
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <Users className="h-3.5 w-3.5 text-success" />
                Total Labour
              </div>
              <div className="font-mono text-3xl font-extrabold tabular-nums mt-3">
                {labour?.totalLabour ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-mono font-semibold text-success">{labour?.activeLabour ?? 0}</span> active
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <HardHat className="h-3.5 w-3.5 text-warning" />
                Labour by Trade
              </div>
              <div className="mt-3">
                {labour?.tradeBreakdown && Object.keys(labour.tradeBreakdown).length > 0 ? (
                  <div className="space-y-1.5">
                    {Object.entries(labour.tradeBreakdown).map(([trade, count]) => (
                      <div key={trade} className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground truncate mr-2">{trade}</span>
                        <Badge variant="outline" className="text-[10px] h-5 font-mono tabular-nums shrink-0">
                          {count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No labour data</p>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
