import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
}

const variantStyles = {
  default: "bg-card",
  primary: "bg-primary/5 border-primary/20",
  success: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900",
  warning: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900",
  destructive: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900",
};

const iconStyles = {
  default: "text-muted-foreground",
  primary: "text-primary",
  success: "text-green-600 dark:text-green-400",
  warning: "text-amber-600 dark:text-amber-400",
  destructive: "text-red-600 dark:text-red-400",
};

export function KPICard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  trendValue,
  variant = "default",
}: KPICardProps) {
  return (
    <Card className={cn("border", variantStyles[variant])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && trendValue && (
              <p
                className={cn(
                  "text-xs font-medium",
                  trend === "up" && "text-green-600 dark:text-green-400",
                  trend === "down" && "text-red-600 dark:text-red-400",
                  trend === "neutral" && "text-muted-foreground"
                )}
              >
                {trend === "up" && "↑ "}
                {trend === "down" && "↓ "}
                {trendValue}
              </p>
            )}
          </div>
          <div className={cn("p-2 rounded-lg bg-muted/50", iconStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}