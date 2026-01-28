import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Calendar, User, DollarSign, AlertTriangle } from "lucide-react";
import { useRiskFlagHistory } from "@/hooks/useSupplierRiskFlags";
import { formatCurrency } from "@/lib/utils";

interface RiskFlagDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riskFlag: any;
}

export function RiskFlagDetailsDialog({ open, onOpenChange, riskFlag }: RiskFlagDetailsDialogProps) {
  const { data: history } = useRiskFlagHistory(riskFlag?.id);

  if (!riskFlag) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Risk Flag Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Risk Info */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Risk Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Supplier</p>
                <p className="font-medium">{riskFlag.suppliers?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={riskFlag.status === 'resolved' ? 'secondary' : 'destructive'}>
                  {riskFlag.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="capitalize">{riskFlag.risk_category}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Severity</p>
                <Badge className={`
                  ${riskFlag.risk_severity === 'critical' && 'bg-red-100 text-red-800'}
                  ${riskFlag.risk_severity === 'high' && 'bg-orange-100 text-orange-800'}
                  ${riskFlag.risk_severity === 'medium' && 'bg-yellow-100 text-yellow-800'}
                  ${riskFlag.risk_severity === 'low' && 'bg-green-100 text-green-800'}
                `}>
                  {riskFlag.risk_severity}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold mb-2">{riskFlag.title}</h3>
            <p className="text-sm text-muted-foreground">{riskFlag.description || "No description provided"}</p>
          </div>

          {riskFlag.financial_impact && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financial Impact
                </p>
                <p className="text-lg font-semibold">{formatCurrency(riskFlag.financial_impact)}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Dates */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Timeline</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Flagged Date
                </p>
                <p className="text-sm">{format(new Date(riskFlag.flagged_date), "MMM d, yyyy")}</p>
              </div>
              {riskFlag.resolved_date && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Resolved Date
                  </p>
                  <p className="text-sm">{format(new Date(riskFlag.resolved_date), "MMM d, yyyy")}</p>
                </div>
              )}
            </div>
          </div>

          {riskFlag.resolution_notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-2">Resolution Notes</h3>
                <p className="text-sm text-muted-foreground">{riskFlag.resolution_notes}</p>
              </div>
            </>
          )}

          {/* History */}
          {history && history.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-3">Activity History</h3>
                <div className="space-y-3">
                  {history.map((entry: any) => (
                    <Card key={entry.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium capitalize">{entry.action_type.replace('_', ' ')}</p>
                            {entry.notes && <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(entry.action_date), "MMM d, yyyy HH:mm")}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
