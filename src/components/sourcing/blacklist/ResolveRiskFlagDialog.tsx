import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSupplierRiskFlags } from "@/hooks/useSupplierRiskFlags";
import { CheckCircle } from "lucide-react";

interface ResolveRiskFlagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riskFlag: any;
}

export function ResolveRiskFlagDialog({ open, onOpenChange, riskFlag }: ResolveRiskFlagDialogProps) {
  const { resolveRiskFlag } = useSupplierRiskFlags();
  const [resolutionNotes, setResolutionNotes] = useState("");

  const handleSubmit = async () => {
    if (!resolutionNotes) return;

    await resolveRiskFlag.mutateAsync({
      id: riskFlag.id,
      resolution_notes: resolutionNotes,
    });

    onOpenChange(false);
    setResolutionNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Resolve Risk Flag
          </DialogTitle>
          <DialogDescription>
            Mark this risk as resolved and provide resolution details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Risk: {riskFlag?.title}</p>
            <p className="text-sm text-muted-foreground">Supplier: {riskFlag?.suppliers?.name}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resolution-notes">Resolution Notes *</Label>
            <Textarea
              id="resolution-notes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Explain how this risk was resolved..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!resolutionNotes || resolveRiskFlag.isPending}
          >
            {resolveRiskFlag.isPending ? "Resolving..." : "Mark as Resolved"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
