import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const accentMap = {
  primary: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  info: "text-info bg-info/10",
  destructive: "text-destructive bg-destructive/10",
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
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className={cn("p-1.5 rounded-md", accentMap[accent])}>
              <Icon className="h-4 w-4" />
            </span>
            {title}
          </CardTitle>
          {href && (
            <Link
              to={href}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              {cta} <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-8 w-32 bg-muted rounded" />
            <div className="h-4 w-48 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        ) : (
          children
        )}
      </CardContent>
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
    <div>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {delta && (
          <span
            className={cn(
              "text-xs font-medium",
              delta.positive ? "text-success" : "text-destructive",
            )}
          >
            {delta.positive ? "↑" : "↓"} {delta.value}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
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
    <div className="flex items-center justify-between text-sm py-1.5 border-t border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold", toneMap[tone])}>{value}</span>
    </div>
  );
}
