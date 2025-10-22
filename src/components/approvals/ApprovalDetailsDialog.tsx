import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UnifiedApproval } from "@/types/approval";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, XCircle, MessageSquare } from "lucide-react";

interface ApprovalDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approval: UnifiedApproval;
}

export function ApprovalDetailsDialog({ 
  open, 
  onOpenChange, 
  approval 
}: ApprovalDetailsDialogProps) {
  const [comments, setComments] = useState("");
  const [action, setAction] = useState<'approve' | 'reject' | 'request_info' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async (actionType: 'approve' | 'reject' | 'request_info') => {
    if (approval.requires_comments && !comments.trim()) {
      toast.error("Comments are required for this action");
      return;
    }

    setAction(actionType);
    setIsSubmitting(true);

    try {
      // Here you would call the appropriate API based on approval type
      // For now, just show a success message
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      toast.success(
        actionType === 'approve' 
          ? "Approval successful" 
          : actionType === 'reject'
          ? "Rejection recorded"
          : "Information requested"
      );
      
      setComments("");
      onOpenChange(false);
    } catch (error) {
      toast.error("Action failed. Please try again.");
    } finally {
      setIsSubmitting(false);
      setAction(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{approval.title}</DialogTitle>
              <DialogDescription className="mt-1">
                {approval.description}
              </DialogDescription>
            </div>
            <Badge 
              variant={approval.priority === 'urgent' ? 'destructive' : 'outline'}
              className="ml-2"
            >
              {approval.priority.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Approval Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Type</Label>
              <p className="font-medium mt-1 capitalize">
                {approval.type.replace(/_/g, ' ')}
              </p>
            </div>
            
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <p className="font-medium mt-1 capitalize">{approval.status}</p>
            </div>
            
            {approval.stage && (
              <div>
                <Label className="text-muted-foreground">Current Stage</Label>
                <p className="font-medium mt-1">{approval.stage}</p>
              </div>
            )}
            
            <div>
              <Label className="text-muted-foreground">Age</Label>
              <p className="font-medium mt-1">
                {approval.age_days} {approval.age_days === 1 ? 'day' : 'days'}
              </p>
            </div>
            
            {approval.amount && (
              <>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="font-medium mt-1">
                    {approval.currency} {approval.amount.toLocaleString()}
                  </p>
                </div>
              </>
            )}
            
            <div>
              <Label className="text-muted-foreground">Created</Label>
              <p className="font-medium mt-1">
                {format(new Date(approval.created_at), 'PPp')}
              </p>
            </div>
          </div>

          <Separator />

          {/* Comments Section */}
          <div className="space-y-2">
            <Label htmlFor="comments">
              Comments {approval.requires_comments && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="comments"
              placeholder="Add your comments here..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              className="resize-none"
            />
            {approval.requires_comments && (
              <p className="text-xs text-muted-foreground">
                Comments are required for this approval
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {approval.can_request_info && (
            <Button
              variant="outline"
              onClick={() => handleAction('request_info')}
              disabled={isSubmitting}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Request Info
            </Button>
          )}
          
          {approval.can_reject && (
            <Button
              variant="destructive"
              onClick={() => handleAction('reject')}
              disabled={isSubmitting}
            >
              <XCircle className="h-4 w-4 mr-2" />
              {isSubmitting && action === 'reject' ? 'Rejecting...' : 'Reject'}
            </Button>
          )}
          
          {approval.can_approve && (
            <Button
              onClick={() => handleAction('approve')}
              disabled={isSubmitting}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isSubmitting && action === 'approve' ? 'Approving...' : 'Approve'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
