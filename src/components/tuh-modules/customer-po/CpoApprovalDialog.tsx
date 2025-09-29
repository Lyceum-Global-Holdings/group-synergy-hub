import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface CpoApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (comments?: string) => void;
  onReject: (comments: string) => void;
  isLoading: boolean;
  action: 'approve' | 'reject';
  cpoNumber: string;
}

export default function CpoApprovalDialog({
  open,
  onOpenChange,
  onApprove,
  onReject,
  isLoading,
  action,
  cpoNumber,
}: CpoApprovalDialogProps) {
  const [comments, setComments] = useState("");

  const handleSubmit = () => {
    if (action === 'approve') {
      onApprove(comments);
    } else {
      if (!comments.trim()) {
        return; // Require comments for rejection
      }
      onReject(comments);
    }
    setComments("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {action === 'approve' ? 'Approve' : 'Reject'} Customer PO
          </DialogTitle>
          <DialogDescription>
            {action === 'approve' 
              ? `Are you sure you want to approve Customer PO ${cpoNumber}?`
              : `Please provide a reason for rejecting Customer PO ${cpoNumber}.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="comments">
              {action === 'approve' ? 'Comments (Optional)' : 'Rejection Reason (Required)'}
            </Label>
            <Textarea
              id="comments"
              placeholder={
                action === 'approve' 
                  ? "Add any approval comments..."
                  : "Please explain why this CPO is being rejected..."
              }
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || (action === 'reject' && !comments.trim())}
            variant={action === 'approve' ? 'default' : 'destructive'}
          >
            {isLoading ? 'Processing...' : action === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}