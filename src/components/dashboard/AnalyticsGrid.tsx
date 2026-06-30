import { Card } from "@/components/ui/card";
import { Loader2, ArrowDownToLine, ArrowUpFromLine, PackageCheck, PackageX, Activity, TrendingUp } from "lucide-react";
import { useDashboardAnalytics } from "@/hooks/useDashboardPulse";
import { MaterialFlowChart } from "./charts/MaterialFlowChart";
import { InboundOutboundChart } from "./charts/InboundOutboundChart";
import { TopItemsBarList } from "./charts/TopItemsBarList";
import { MovementMixDonut } from "./charts/MovementMixDonut";
import { SpendTrendChart } from "./charts/SpendTrendChart";
import { MaterialFlowSankey } from "./charts/MaterialFlowSankey";
import { Workflow } from "lucide-react";

interface Props {
  companyId: string | null;
  locationId: string | null;
}

interface PanelProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent?: "primary" | "warning" | "destructive" | "success";
  children: React.ReactNode;
  className?: string;
}

function Panel({ title, subtitle, icon, accent = "primary", children, className }: PanelProps) {
  const rail = {
    primary: "border-l-primary",
    warning: "border-l-warning",
    destructive: "border-l-destructive",
    success: "border-l-success",
  }[accent];
  return (
    <Card className={`p-5 border-l-2 ${rail} ${className ?? ""}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-muted text-muted-foreground">{icon}</div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      {children}
    </Card>
  );
}

export function AnalyticsGrid({ companyId, locationId }: Props) {
  const { data, isLoading } = useDashboardAnalytics(companyId, locationId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pt-2">
        <div className="h-px flex-1 bg-border" />
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          Material Flow Analytics
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel
          title="Material Flow Map"
          subtitle="GRN + Returns → Inventory → Issues · 30d · by location / product"
          icon={<Workflow className="h-4 w-4" />}
          accent="primary"
          className="lg:col-span-3"
        >
          <MaterialFlowSankey
            overall={data?.sankey}
            byLocation={data?.sankey_by_location}
            byProduct={data?.sankey_by_product}
          />
        </Panel>

        <Panel
          title="Material Flow"
          subtitle="Issued vs Returned · 14d"
          icon={<Activity className="h-4 w-4" />}
          accent="primary"
          className="lg:col-span-2"
        >
          <MaterialFlowChart data={data?.material_flow ?? []} />
        </Panel>

        <Panel
          title="Stock Movement Mix"
          subtitle="By Type · 7d"
          icon={<Activity className="h-4 w-4" />}
          accent="success"
        >
          <MovementMixDonut data={data?.movement_mix ?? []} />
        </Panel>

        <Panel
          title="Inbound vs Outbound"
          subtitle="GRN vs Issue · 30d"
          icon={<ArrowDownToLine className="h-4 w-4" />}
          accent="primary"
          className="lg:col-span-2"
        >
          <InboundOutboundChart data={data?.inbound_outbound ?? []} />
        </Panel>

        <Panel
          title="PO Spend Trend"
          subtitle="Weekly · 12w"
          icon={<TrendingUp className="h-4 w-4" />}
          accent="success"
        >
          <SpendTrendChart data={data?.spend_trend ?? []} />
        </Panel>

        <Panel
          title="Top Issued Items"
          subtitle="By Quantity · 30d"
          icon={<ArrowUpFromLine className="h-4 w-4" />}
          accent="primary"
        >
          <TopItemsBarList data={data?.top_issued ?? []} tone="primary" />
        </Panel>

        <Panel
          title="Top Returned Items"
          subtitle="By Quantity · 30d"
          icon={<PackageX className="h-4 w-4" />}
          accent="warning"
        >
          <TopItemsBarList data={data?.top_returned ?? []} tone="warning" />
        </Panel>

        <Panel
          title="Reconciliation Signal"
          subtitle="Return vs Issue Ratio · 14d"
          icon={<PackageCheck className="h-4 w-4" />}
          accent="success"
        >
          <ReconciliationSignal data={data?.material_flow ?? []} />
        </Panel>
      </div>
    </div>
  );
}

function ReconciliationSignal({ data }: { data: Array<{ issued: number; returned: number }> }) {
  const totalIssued = data.reduce((s, r) => s + Number(r.issued || 0), 0);
  const totalReturned = data.reduce((s, r) => s + Number(r.returned || 0), 0);
  const ratio = totalIssued > 0 ? (totalReturned / totalIssued) * 100 : 0;
  const tone = ratio > 15 ? "text-warning" : ratio > 5 ? "text-foreground" : "text-success";
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-3xl font-extrabold tabular-nums ${tone}`}>{ratio.toFixed(1)}%</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">return rate</span>
      </div>
      <div className="space-y-1.5 pt-2 border-t border-border">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Issued (14d)</span>
          <span className="font-mono tabular-nums text-foreground">{totalIssued.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Returned (14d)</span>
          <span className="font-mono tabular-nums text-foreground">{totalReturned.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Net Consumption</span>
          <span className="font-mono tabular-nums font-semibold text-foreground">
            {(totalIssued - totalReturned).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
