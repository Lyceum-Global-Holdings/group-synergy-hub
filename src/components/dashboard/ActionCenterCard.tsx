import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, FileSearch, LucideIcon, PackageCheck, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HealthStrip } from "@/hooks/useDashboardPulse";
import { DashCard, DashCardHeader, HERO_GRADIENT, Skeleton } from "./DashCard";
import { useAccessibleNav } from "@/components/layout/useAccessibleNav";

interface Props {
  health: HealthStrip | undefined;
  loading?: boolean;
  className?: string;
}

interface Action {
  count: number;
  title: string;
  short: string;
  hint: string;
  cta: string;
  href: string;
  icon: LucideIcon;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

// Ordered by urgency: approvals block other people's work, stock alerts risk
// stock-outs, then receiving and sourcing follow-ups.
function buildActions(h?: HealthStrip): Action[] {
  if (!h) return [];
  const all: Action[] = [
    {
      count: h.approvals_pending,
      title: `${plural(h.approvals_pending, "approval")} awaiting sign-off`,
      short: plural(h.approvals_pending, "approval"),
      hint: "Requests stay on hold until they're approved.",
      cta: "Review approvals",
      href: "/management/approvals",
      icon: Clock,
    },
    {
      count: h.low_stock,
      title: `${plural(h.low_stock, "item")} below reorder level`,
      short: plural(h.low_stock, "stock alert"),
      hint: "Reorder before these run out.",
      cta: "Check inventory",
      href: "/warehouse/inventory",
      icon: AlertTriangle,
    },
    {
      count: h.grn_pending,
      title: `${plural(h.grn_pending, "GRN")} awaiting receipt`,
      short: plural(h.grn_pending, "pending GRN"),
      hint: "Receive delivered goods so stock stays accurate.",
      cta: "Open GRNs",
      href: "/warehouse/grn",
      icon: PackageCheck,
    },
    {
      count: h.rfqs_open,
      title: `${plural(h.rfqs_open, "RFQ")} collecting quotes`,
      short: plural(h.rfqs_open, "open RFQ"),
      hint: "Compare quotes and award suppliers.",
      cta: "Open RFQs",
      href: "/sourcing/rfq-management",
      icon: FileSearch,
    },
  ];
  return all.filter((a) => a.count > 0);
}

export function ActionCenterCard({ health, loading, className }: Props) {
  const { canOpenPath } = useAccessibleNav();
  const actions = buildActions(health).filter((a) => canOpenPath(a.href));
  const [top, ...rest] = actions;

  return (
    <DashCard className={cn("flex flex-col", className)}>
      <DashCardHeader title="Next Up" subtitle="Your highest-priority action" />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="mt-8 h-11 w-full rounded-full" />
        </div>
      ) : top ? (
        <>
          <p className="text-xl font-semibold leading-snug tracking-tight text-primary">{top.title}</p>
          <p className="mt-2 text-xs text-muted-foreground">{top.hint}</p>
          <div className="mt-auto pt-6">
            <Button
              asChild
              className={cn(HERO_GRADIENT, "h-11 w-full rounded-full text-white shadow-lg shadow-primary/25 hover:brightness-110")}
            >
              <Link to={top.href}>
                <top.icon className="mr-2 h-4 w-4" />
                {top.cta}
              </Link>
            </Button>
            {rest.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {rest.map((a) => (
                  <Link
                    key={a.href}
                    to={a.href}
                    className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    {a.short}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
            <CheckCircle2 className="h-5 w-5 text-success" />
            All caught up
          </div>
          <p className="mt-2 text-xs text-muted-foreground">No approvals, stock alerts or pending receipts.</p>
          <div className="mt-auto pt-6">
            <Button asChild variant="outline" className="h-11 w-full rounded-full">
              <a href="/scanner/">
                <ScanLine className="mr-2 h-4 w-4" />
                Open Scanner
              </a>
            </Button>
          </div>
        </>
      )}
    </DashCard>
  );
}
