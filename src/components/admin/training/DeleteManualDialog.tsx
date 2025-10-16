import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDeleteManual, type TrainingManual } from "@/hooks/useTrainingManuals";
import { Loader2 } from "lucide-react";

interface DeleteManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manual: TrainingManual | null;
}

export default function DeleteManualDialog({ open, onOpenChange, manual }: DeleteManualDialogProps) {
  const deleteManual = useDeleteManual();

  const handleDelete = async () => {
    if (!manual) return;

    try {
      await deleteManual.mutateAsync(manual.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting manual:", error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Training Manual</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{manual?.title}"? This action cannot be undone and will permanently remove the file and all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteManual.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteManual.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
