import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { JournalEntry } from "@/types/generalLedger";
import { format } from "date-fns";
import { FileText, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { toast } from "sonner";

interface JournalEntryDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalEntry: JournalEntry;
}

export function JournalEntryDetailsDialog({ open, onOpenChange, journalEntry }: JournalEntryDetailsDialogProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const { postJournalEntry, voidJournalEntry, deleteJournalEntry } = useJournalEntries();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'LKR'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-500/10 text-gray-500",
      posted: "bg-green-500/10 text-green-500",
      void: "bg-red-500/10 text-red-500",
      reversed: "bg-orange-500/10 text-orange-500"
    };
    return colors[status] || "bg-gray-500/10 text-gray-500";
  };

  const handlePost = async () => {
    try {
      await postJournalEntry.mutateAsync(journalEntry.id);
      toast.success("Journal entry posted successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to post journal entry");
    }
  };

  const handleVoid = async () => {
    try {
      await voidJournalEntry.mutateAsync(journalEntry.id);
      toast.success("Journal entry voided");
      setShowVoidDialog(false);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to void journal entry");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteJournalEntry.mutateAsync(journalEntry.id);
      toast.success("Journal entry deleted");
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to delete journal entry");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Journal Entry Details</DialogTitle>
              <Badge className={getStatusBadge(journalEntry.status)}>
                {journalEntry.status.toUpperCase()}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Header Information */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">JE Number:</span>
                <span className="ml-2 font-medium">{journalEntry.journal_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>
                <span className="ml-2 font-medium">{format(new Date(journalEntry.journal_date), "MMM dd, yyyy")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 font-medium capitalize">{journalEntry.journal_type.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2 font-medium capitalize">{journalEntry.status}</span>
              </div>
              {journalEntry.reference_type && (
                <div>
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="ml-2 font-medium">{journalEntry.reference_type} - {journalEntry.reference_number}</span>
                </div>
              )}
              {journalEntry.posted_date && (
                <div>
                  <span className="text-muted-foreground">Posted:</span>
                  <span className="ml-2 font-medium">{format(new Date(journalEntry.posted_date), "MMM dd, yyyy")}</span>
                </div>
              )}
            </div>

            <div>
              <span className="text-sm text-muted-foreground">Description:</span>
              <p className="mt-1">{journalEntry.description}</p>
            </div>

            <Separator />

            {/* Journal Entry Lines */}
            <div>
              <h4 className="font-semibold mb-3">Journal Entry Lines</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Account</th>
                      <th className="text-left p-3">Description</th>
                      <th className="text-right p-3">Debit</th>
                      <th className="text-right p-3">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalEntry.lines?.map((line) => (
                      <tr key={line.id} className="border-t">
                        <td className="p-3">
                          {line.account ? `${line.account.account_code} - ${line.account.account_name}` : 'Unknown Account'}
                        </td>
                        <td className="p-3">{line.description || '-'}</td>
                        <td className="text-right p-3">
                          {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                        </td>
                        <td className="text-right p-3">
                          {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t font-bold bg-muted">
                      <td colSpan={2} className="p-3">Total</td>
                      <td className="text-right p-3">{formatCurrency(journalEntry.total_debit)}</td>
                      <td className="text-right p-3">{formatCurrency(journalEntry.total_credit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {journalEntry.is_balanced && (
                <p className="text-sm text-green-600 mt-2">✓ Entry is balanced</p>
              )}
            </div>

            <Separator />

            {/* Audit Trail */}
            <div className="text-sm space-y-2">
              <h4 className="font-semibold">Audit Trail</h4>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div>Created: {format(new Date(journalEntry.created_at), "MMM dd, yyyy HH:mm")}</div>
                <div>Updated: {format(new Date(journalEntry.updated_at), "MMM dd, yyyy HH:mm")}</div>
                {journalEntry.posted_date && (
                  <div>Posted: {format(new Date(journalEntry.posted_date), "MMM dd, yyyy HH:mm")}</div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              {journalEntry.status === 'draft' && (
                <>
                  <Button variant="outline" onClick={handlePost} disabled={postJournalEntry.isPending}>
                    <FileText className="h-4 w-4 mr-2" />
                    Post Entry
                  </Button>
                  <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
              {journalEntry.status === 'posted' && (
                <Button variant="destructive" onClick={() => setShowVoidDialog(true)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Void Entry
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Journal Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete journal entry {journalEntry.journal_number}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Confirmation */}
      <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Journal Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will void journal entry {journalEntry.journal_number}. The entry will be marked as void and cannot be un-voided.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} className="bg-destructive text-destructive-foreground">
              Void Entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
