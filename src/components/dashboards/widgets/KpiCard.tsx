import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { useKpiData } from "@/hooks/useKpiData";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  kpiId: string;
  title?: string;
  refreshInterval?: number;
}

export function KpiCard({ kpiId, title, refreshInterval }: KpiCardProps) {
  const { data: kpiValue, isLoading } = useKpiData(kpiId, refreshInterval);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!kpiValue) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = () => {
    if (!kpiValue.trend) return <Minus className="h-4 w-4" />;
    if (kpiValue.trend === 'up') return <TrendingUp className="h-4 w-4" />;
    if (kpiValue.trend === 'down') return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColor = () => {
    if (!kpiValue.trend) return "text-muted-foreground";
    if (kpiValue.trend === 'up') return "text-success";
    if (kpiValue.trend === 'down') return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {title || kpiValue.kpi.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold">
            {kpiValue.current_value.toLocaleString()}
            {kpiValue.kpi.unit && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {kpiValue.kpi.unit}
              </span>
            )}
          </div>
          {kpiValue.change_percentage !== undefined && (
            <div className={cn("flex items-center gap-1 text-sm", getTrendColor())}>
              {getTrendIcon()}
              <span>{Math.abs(kpiValue.change_percentage).toFixed(1)}%</span>
            </div>
          )}
        </div>
        {kpiValue.kpi.description && (
          <p className="text-xs text-muted-foreground mt-2">
            {kpiValue.kpi.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
