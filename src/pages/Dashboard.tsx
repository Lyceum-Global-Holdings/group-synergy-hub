import { ReactNode } from "react";
import { HardHat, Wrench, Boxes, Users, ScanLine, BarChart3, LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDashboardLocations } from "@/hooks/useWarehouseLocations";
import { useDashboardLocationData } from "@/hooks/useDashboardLocationData";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useAccessibleNav } from "@/components/layout/useAccessibleNav";
import { useIsAdminOrHigher } from "@/hooks/useIsAdminOrHigher";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import {
  useDashboardAnalytics,
  useDashboardRealtime,
  useDashboardSankeyFlow,
  useHealthStrip,
} from "@/hooks/useDashboardPulse";
import { cn } from "@/lib/utils";
import { HealthStrip } from "@/components/dashboard/HealthStrip";
import { LivePulseIndicator } from "@/components/dashboard/LivePulseIndicator";
import { WarehousePillar } from "@/components/dashboard/WarehousePillar";
import { ProcurementPillar } from "@/components/dashboard/ProcurementPillar";
import { SourcingPillar } from "@/components/dashboard/SourcingPillar";
import { FinancePillar } from "@/components/dashboard/FinancePillar";
import { WeeklyActivityCard } from "@/components/dashboard/WeeklyActivityCard";
import { ActionCenterCard } from "@/components/dashboard/ActionCenterCard";
import { TopItemsCard } from "@/components/dashboard/TopItemsCard";
import { ReturnRateCard } from "@/components/dashboard/ReturnRateCard";
import { DashCard, DashCardHeader, HERO_GRADIENT, Skeleton } from "@/components/dashboard/DashCard";
import { MaterialFlowChart, FLOW_COLORS } from "@/components/dashboard/charts/MaterialFlowChart";
import { InboundOutboundChart, IO_COLORS } from "@/components/dashboard/charts/InboundOutboundChart";
import { SpendTrendChart } from "@/components/dashboard/charts/SpendTrendChart";
import { MovementMixGauge } from "@/components/dashboard/charts/MovementMixGauge";
import { MaterialFlowSankey } from "@/components/dashboard/charts/MaterialFlowSankey";
import { ChartLegend } from "@/components/dashboard/charts/ChartLegend";

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-2 text-sm font-semibold text-muted-foreground">{children}</h2>;
}

function ChartSkeleton() {
  return <Skeleton className="h-[240px] w-full rounded-2xl" />;
}

function MiniStatCard({
  icon: Icon,
  title,
  value,
  caption,
  children,
}: {
  icon: LucideIcon;
  title: string;
  value: ReactNode;
  caption: ReactNode;
  children?: ReactNode;
}) {
  return (
    <DashCard>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      <div className="mt-4 text-3xl font-semibold leading-none tracking-tight tabular-nums">{value}</div>
      <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
      {children}
    </DashCard>
  );
}

function Breakdown({ entries }: { entries: Array<[string, number]> }) {
  if (entries.length === 0) return null;
  return (
    <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-muted-foreground">{k}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium tabular-nums">{v}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { globalLocationId } = useLocationFilter();
  const { selectedCompany } = useCompany();
  const { canOpenPath } = useAccessibleNav();
  const { canDelete: isAdminOrHigher } = useIsAdminOrHigher();
  const { data: profile } = useCurrentUserProfile();
  const { data: locations } = useDashboardLocations(selectedCompany?.id);
  const activeLocationId = globalLocationId;
  const companyId = selectedCompany?.id ?? null;

  const { inventory, labour, isLoading: locationDataLoading } = useDashboardLocationData(activeLocationId);
  const { live } = useDashboardRealtime();
  const { data: health, isLoading: healthLoading } = useHealthStrip(companyId, activeLocationId);
  const { data: analytics, isLoading: analyticsLoading } = useDashboardAnalytics(companyId, activeLocationId);
  const { data: sankeyFlow } = useDashboardSankeyFlow(companyId, activeLocationId);

  const selectedLocationName =
    globalLocationId === null
      ? "All Locations"
      : locations?.find((l) => l.id === globalLocationId)?.name || "Selected Location";
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {greeting()}
            {firstName ? `, ${firstName}` : ""} 👋
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Operations Pulse
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Warehouse, procurement, sourcing and finance at a glance
            {selectedCompany ? ` · ${selectedCompany.name}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LivePulseIndicator live={live} />
          {canOpenPath("/management/reports") && (
            <Button asChild variant="outline" className="h-11 rounded-full px-5">
              <Link to="/management/reports">
                <BarChart3 className="mr-2 h-4 w-4" />
                Reports
              </Link>
            </Button>
          )}
          <Button
            asChild
            className={cn(HERO_GRADIENT, "h-11 rounded-full px-5 text-white shadow-lg shadow-primary/25 hover:brightness-110")}
          >
            <a href="/scanner/" aria-label="Open Scanner app">
              <ScanLine className="mr-2 h-4 w-4" />
              Open Scanner
            </a>
          </Button>
        </div>
      </div>

      {/* KPI tiles */}
      <HealthStrip data={health} loading={healthLoading} />

      {/* Activity · next action · top items */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
        <WeeklyActivityCard
          data={analytics?.material_flow}
          loading={analyticsLoading}
          className="md:col-span-2 lg:col-span-5"
        />
        <ActionCenterCard health={health} loading={healthLoading} className="lg:col-span-3" />
        <TopItemsCard
          issued={analytics?.top_issued}
          returned={analytics?.top_returned}
          loading={analyticsLoading}
          className="lg:col-span-4"
        />
      </div>

      {/* Material flow trend · movement mix */}
      <div className="grid gap-4 lg:grid-cols-12">
        <DashCard className="lg:col-span-8">
          <DashCardHeader
            title="Material Flow"
            subtitle="Units issued vs returned, last 14 days"
            action={
              <ChartLegend
                items={[
                  { label: "Issued", color: FLOW_COLORS.issued },
                  { label: "Returned", color: FLOW_COLORS.returned, dashed: true },
                ]}
              />
            }
          />
          {analyticsLoading ? <ChartSkeleton /> : <MaterialFlowChart data={analytics?.material_flow ?? []} />}
        </DashCard>
        <DashCard className="flex flex-col lg:col-span-4">
          <DashCardHeader title="Stock Movement Mix" subtitle="By movement type, last 7 days" />
          {analyticsLoading ? <ChartSkeleton /> : <MovementMixGauge data={analytics?.movement_mix ?? []} />}
        </DashCard>
      </div>

      {/* Departments */}
      <SectionTitle>Departments</SectionTitle>
      <div className={cn("grid gap-4 md:grid-cols-2", isAdminOrHigher ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
        <WarehousePillar companyId={companyId} locationId={activeLocationId} />
        <ProcurementPillar companyId={companyId} />
        <SourcingPillar companyId={companyId} />
        {isAdminOrHigher && <FinancePillar companyId={companyId} />}
      </div>

      {/* Trends */}
      <SectionTitle>Trends</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-12">
        <DashCard className="lg:col-span-5">
          <DashCardHeader
            title="Inbound vs Outbound"
            subtitle="GRN receipts vs issues, last 30 days"
            action={
              <ChartLegend
                items={[
                  { label: "In", color: IO_COLORS.inbound },
                  { label: "Out", color: IO_COLORS.outbound },
                ]}
              />
            }
          />
          {analyticsLoading ? <ChartSkeleton /> : <InboundOutboundChart data={analytics?.inbound_outbound ?? []} />}
        </DashCard>
        <DashCard className="lg:col-span-4">
          <DashCardHeader title="PO Spend Trend" subtitle="Weekly, last 12 weeks" />
          {analyticsLoading ? <ChartSkeleton /> : <SpendTrendChart data={analytics?.spend_trend ?? []} />}
        </DashCard>
        <ReturnRateCard data={analytics?.material_flow} loading={analyticsLoading} className="lg:col-span-3" />
      </div>

      <DashCard>
        <DashCardHeader
          title="Material Flow Map"
          subtitle="GRN + returns → location → product → issues, last 30 days"
        />
        <MaterialFlowSankey
          data={sankeyFlow}
          emptyText={
            companyId
              ? undefined
              : "Select a company in the top bar to see how material flows through its locations."
          }
        />
      </DashCard>

      {/* Construction — location filtered */}
      <SectionTitle>Construction · {selectedLocationName}</SectionTitle>
      {locationDataLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MiniStatCard
            icon={Wrench}
            title="Serial-Tracked Assets"
            value={(inventory?.serialCount ?? 0).toLocaleString()}
            caption="Machines and equipment with serials"
          >
            <Breakdown entries={Object.entries(inventory?.conditionBreakdown ?? {}) as Array<[string, number]>} />
          </MiniStatCard>
          <MiniStatCard
            icon={Boxes}
            title="Bulk Stock Items"
            value={(inventory?.bulkItemCount ?? 0).toLocaleString()}
            caption={
              <>
                Total qty{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {(inventory?.totalBulkQty ?? 0).toLocaleString()}
                </span>{" "}
                units
              </>
            }
          />
          <MiniStatCard
            icon={Users}
            title="Total Labour"
            value={(labour?.totalLabour ?? 0).toLocaleString()}
            caption={
              <>
                <span className="font-semibold tabular-nums text-success">{labour?.activeLabour ?? 0}</span> active
              </>
            }
          />
          <DashCard>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <HardHat className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-foreground">Labour by Trade</p>
            </div>
            {labour?.tradeBreakdown && Object.keys(labour.tradeBreakdown).length > 0 ? (
              <Breakdown entries={Object.entries(labour.tradeBreakdown) as Array<[string, number]>} />
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No labour data</p>
            )}
          </DashCard>
        </div>
      )}
    </div>
  );
}
