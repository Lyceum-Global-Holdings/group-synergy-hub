import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSupplierRiskFlags } from "@/hooks/useSupplierRiskFlags";
import { AlertTriangle } from "lucide-react";
import { RISK_SEVERITIES } from "@/types/supplierRisk";
import type { RiskSeverity } from "@/types/supplierRisk";

interface EscalateRiskFlagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riskFlag: any;
}

export function EscalateRiskFlagDialog({ open, onOpenChange, riskFlag }: EscalateRiskFlagDialogProps) {
  const { escalateRiskFlag } = useSupplierRiskFlags();
  const [newSeverity, setNewSeverity] = useState<RiskSeverity>(riskFlag?.risk_severity || "high");

  const handleSubmit = async () => {
    await escalateRiskFlag.mutateAsync({
      id: riskFlag.id,
      new_severity: newSeverity,
    });

    onOpenChange(false);
  };

  const availableSeverities = RISK_SEVERITIES.filter(sev => {
    const currentIndex = RISK_SEVERITIES.findIndex(s => s.value === riskFlag?.risk_severity);
    const sevIndex = RISK_SEVERITIES.findIndex(s => s.value === sev.value);
    return sevIndex > currentIndex;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Escalate Risk Flag
          </DialogTitle>
          <DialogDescription>
            Increase the severity level of this risk flag
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Risk: {riskFlag?.title}</p>
            <p className="text-sm text-muted-foreground">Current Severity: <span className="capitalize">{riskFlag?.risk_severity}</span></p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-severity">New Severity Level *</Label>
            <Select value={newSeverity} onValueChange={(value: RiskSeverity) => setNewSeverity(value)}>
              <SelectTrigger id="new-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableSeverities.length > 0 ? (
                  availableSeverities.map((sev) => (
                    <SelectItem key={sev.value} value={sev.value}>
                      {sev.label}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value={riskFlag?.risk_severity} disabled>
                    Already at highest severity
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={availableSeverities.length === 0 || escalateRiskFlag.isPending}
            variant="destructive"
          >
            {escalateRiskFlag.isPending ? "Escalating..." : "Escalate Risk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
