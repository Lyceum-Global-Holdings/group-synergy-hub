import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useContractMutations } from "@/hooks/useContractMutations";
import { Contract } from "@/types/contracts";
import { AlertTriangle } from "lucide-react";

interface DeleteContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract | null;
  onSuccess?: () => void;
}

export const DeleteContractDialog = ({
  open,
  onOpenChange,
  contract,
  onSuccess,
}: DeleteContractDialogProps) => {
  const { deleteContract } = useContractMutations();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!contract) return;

    setIsDeleting(true);
    try {
      await deleteContract.mutateAsync(contract.id);
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2">
            <p>Are you sure you want to delete this contract?</p>
            {contract && (
              <div className="mt-3 p-3 bg-muted rounded-md space-y-1">
                <p className="font-medium text-foreground">
                  {contract.contract_number}
                </p>
                <p className="text-sm">{contract.contract_title}</p>
                <p className="text-xs text-muted-foreground">
                  Type: {contract.contract_type.replace(/_/g, " ")}
                </p>
              </div>
            )}
            <p className="text-destructive font-medium mt-3">
              This action cannot be undone. All related documents, parties, obligations, and amendments will also be deleted.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete Contract"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
