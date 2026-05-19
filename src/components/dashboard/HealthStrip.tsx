import { ShoppingCart, PackageCheck, AlertTriangle, FileSearch, Clock, LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { HealthStrip as HealthStripData } from "@/hooks/useDashboardPulse";

interface HealthStripProps {
  data: HealthStripData | undefined;
  loading: boolean;
}

interface Tile {
  label: string;
  value: number;
  delta?: { label: string; positive: boolean } | null;
  icon: LucideIcon;
  href: string;
  tone: "primary" | "warning" | "destructive" | "info" | "success";
}

const toneRing = {
  primary: "ring-primary/20 hover:ring-primary/40",
  warning: "ring-warning/20 hover:ring-warning/40",
  destructive: "ring-destructive/20 hover:ring-destructive/40",
  info: "ring-info/20 hover:ring-info/40",
  success: "ring-success/20 hover:ring-success/40",
};

const toneIcon = {
  primary: "text-primary bg-primary/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
  info: "text-info bg-info/10",
  success: "text-success bg-success/10",
};

export function HealthStrip({ data, loading }: HealthStripProps) {
  const poDelta = data
    ? (() => {
        const diff = data.po_today - data.po_yesterday;
        if (data.po_yesterday === 0 && diff === 0) return null;
        return {
          label: data.po_yesterday === 0 ? `+${diff}` : `${diff > 0 ? "+" : ""}${diff}`,
          positive: diff >= 0,
        };
      })()
    : null;

  const tiles: Tile[] = [
    {
      label: "Purchase Orders Today",
      value: data?.po_today ?? 0,
      delta: poDelta,
      icon: ShoppingCart,
      href: "/procurement/purchase-orders",
      tone: "primary",
    },
    {
      label: "GRNs Pending",
      value: data?.grn_pending ?? 0,
      icon: PackageCheck,
      href: "/warehouse/goods-receipt-note",
      tone: "info",
    },
    {
      label: "Stock Alerts",
      value: data?.low_stock ?? 0,
      icon: AlertTriangle,
      href: "/warehouse/inventory",
      tone: (data?.low_stock ?? 0) > 0 ? "destructive" : "success",
    },
    {
      label: "Open RFQs",
      value: data?.rfqs_open ?? 0,
      icon: FileSearch,
      href: "/sourcing/rfq-management",
      tone: "info",
    },
    {
      label: "Pending Approvals",
      value: data?.approvals_pending ?? 0,
      icon: Clock,
      href: "/management/approval-console",
      tone: (data?.approvals_pending ?? 0) > 5 ? "warning" : "primary",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {tiles.map((t) => (
        <Link key={t.label} to={t.href} className="block">
          <Card
            className={cn(
              "ring-1 transition-all hover:shadow-md hover:-translate-y-0.5",
              toneRing[t.tone],
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <span className={cn("p-1.5 rounded-md", toneIcon[t.tone])}>
                  <t.icon className="h-4 w-4" />
                </span>
                {t.delta && (
                  <span
                    className={cn(
                      "text-xs font-medium",
                      t.delta.positive ? "text-success" : "text-destructive",
                    )}
                  >
                    {t.delta.positive ? "↑" : "↓"} {t.delta.label}
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold tracking-tight">
                {loading ? <span className="inline-block h-7 w-12 bg-muted rounded animate-pulse" /> : t.value.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{t.label}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
