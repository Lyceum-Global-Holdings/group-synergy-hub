import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { ArrowRight, LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PillarCardProps {
  title: string;
  icon: LucideIcon;
  accent?: "primary" | "success" | "warning" | "info" | "destructive";
  href?: string;
  cta?: string;
  loading?: boolean;
  children: ReactNode;
}

const accentText = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  destructive: "text-destructive",
};

const accentRail = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
};

export function PillarCard({
  title,
  icon: Icon,
  accent = "primary",
  href,
  cta = "View module",
  loading,
  children,
}: PillarCardProps) {
  return (
    <Card className="flex flex-col h-full overflow-hidden p-0 transition-shadow hover:shadow-[var(--shadow-md)]">
      {/* Panel header with accent rail */}
      <div className="relative flex items-center justify-between px-5 py-3 border-b border-border bg-[hsl(var(--surface-2))]">
        <span className={cn("absolute left-0 top-0 bottom-0 w-0.5", accentRail[accent])} />
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", accentText[accent])} />
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/80">
            {title}
          </span>
        </div>
        {href && (
          <Link
            to={href}
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.1em] inline-flex items-center gap-1 transition-colors hover:underline",
              accentText[accent],
            )}
          >
            {cta} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="flex-1 p-6">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-8 w-36 bg-muted rounded" />
            <div className="h-3 w-48 bg-muted rounded" />
            <div className="h-16 bg-muted/60 rounded" />
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

interface HeroMetricProps {
  value: ReactNode;
  label: string;
  delta?: { value: string; positive?: boolean } | null;
}

export function HeroMetric({ value, label, delta }: HeroMetricProps) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-2">
        <div className="font-mono text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
          {value}
        </div>
        {delta && (
          <span
            className={cn(
              "text-[11px] font-semibold",
              delta.positive ? "text-success" : "text-destructive",
            )}
          >
            {delta.positive ? "↑" : "↓"} {delta.value}
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

interface SecondaryStatProps {
  label: string;
  value: ReactNode;
  tone?: "default" | "warning" | "destructive" | "success";
}

export function SecondaryStat({ label, value, tone = "default" }: SecondaryStatProps) {
  const toneMap = {
    default: "text-foreground",
    warning: "text-warning",
    destructive: "text-destructive",
    success: "text-success",
  };
  return (
    <div className="flex items-center justify-between py-2 border-t border-border-subtle first:border-t-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-xs font-bold tabular-nums", toneMap[tone])}>
        {value}
      </span>
    </div>
  );
}
