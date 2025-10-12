import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSupplierBlacklist } from "@/hooks/useSupplierBlacklist";
import { CheckCircle } from "lucide-react";

interface ClearBlacklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blacklistEntry: any;
}

export function ClearBlacklistDialog({ open, onOpenChange, blacklistEntry }: ClearBlacklistDialogProps) {
  const { clearBlacklist } = useSupplierBlacklist();
  const [clearingReason, setClearingReason] = useState("");

  const handleSubmit = async () => {
    if (!clearingReason) return;

    await clearBlacklist.mutateAsync({
      id: blacklistEntry.id,
      clearing_reason: clearingReason,
    });

    onOpenChange(false);
    setClearingReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Clear Supplier from Blacklist
          </DialogTitle>
          <DialogDescription>
            Provide reasoning for clearing {blacklistEntry?.suppliers?.name} from the blacklist
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clearing-reason">Reason for Clearing *</Label>
            <Textarea
              id="clearing-reason"
              value={clearingReason}
              onChange={(e) => setClearingReason(e.target.value)}
              placeholder="Explain why this supplier should be cleared..."
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
            disabled={!clearingReason || clearBlacklist.isPending}
          >
            {clearBlacklist.isPending ? "Clearing..." : "Clear Supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
