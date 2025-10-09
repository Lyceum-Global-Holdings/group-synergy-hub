import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAccountingPeriods } from "@/hooks/useAccountingPeriods";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export function AccountingPeriodsTab() {
  const { periods, fiscalYears, isLoading } = useAccountingPeriods();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Accounting Periods</h2>
          <p className="text-muted-foreground mt-1">
            Manage fiscal years and accounting periods
          </p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Fiscal Year
        </Button>
      </div>

      {/* Fiscal Years */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Fiscal Years</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fiscalYears?.map((year) => (
            <Card key={year.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold">{year.year_name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(year.start_date), "MMM dd, yyyy")} -{" "}
                    {format(new Date(year.end_date), "MMM dd, yyyy")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {year.is_current && (
                    <Badge className="bg-green-100 text-green-800">Current</Badge>
                  )}
                  <Badge
                    variant={
                      year.status === "open"
                        ? "default"
                        : year.status === "closed"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {year.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Accounting Periods */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Accounting Periods</h3>
        <Card className="p-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading periods...</div>
          ) : periods && periods.length > 0 ? (
            <div className="space-y-2">
              {periods.map((period) => (
                <div
                  key={period.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">{period.period_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(period.start_date), "MMM dd")} -{" "}
                        {format(new Date(period.end_date), "MMM dd, yyyy")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        period.status === "open"
                          ? "default"
                          : period.status === "closed"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {period.status.toUpperCase()}
                    </Badge>
                    {period.status === "open" && (
                      <Button variant="outline" size="sm">
                        Close Period
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No accounting periods found
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
