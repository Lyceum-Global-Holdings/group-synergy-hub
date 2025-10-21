import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useContractMutations } from "@/hooks/useContractMutations";
import { Contract, ContractStatus } from "@/types/contracts";

interface ChangeContractStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract | null;
}

const statusOptions: { value: ContractStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "terminated", label: "Terminated" },
  { value: "suspended", label: "Suspended" },
  { value: "renewed", label: "Renewed" },
];

export const ChangeContractStatusDialog = ({
  open,
  onOpenChange,
  contract,
}: ChangeContractStatusDialogProps) => {
  const { updateContractStatus } = useContractMutations();
  const [newStatus, setNewStatus] = useState<ContractStatus | "">("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!contract || !newStatus) return;

    setIsSubmitting(true);
    try {
      await updateContractStatus.mutateAsync({
        id: contract.id,
        status: newStatus,
        notes,
      });
      onOpenChange(false);
      setNewStatus("");
      setNotes("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Contract Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {contract && (
            <div className="p-3 bg-muted rounded-md space-y-1">
              <p className="font-medium text-sm">{contract.contract_number}</p>
              <p className="text-sm text-muted-foreground">{contract.contract_title}</p>
              <p className="text-xs text-muted-foreground">
                Current Status: <span className="capitalize">{contract.status.replace(/_/g, " ")}</span>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-status">New Status</Label>
            <Select value={newStatus} onValueChange={(value) => setNewStatus(value as ContractStatus)}>
              <SelectTrigger id="new-status">
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={contract?.status === option.value}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Reason for status change..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!newStatus || isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Change Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
