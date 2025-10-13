import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { ApprovalLevel, ApprovalAction } from "@/types/assetRequest";
import { Loader2 } from "lucide-react";

interface AssetRequestApprovalDialogProps {
  requestId: string | null;
  approvalLevel: ApprovalLevel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssetRequestApprovalDialog({
  requestId,
  approvalLevel,
  open,
  onOpenChange,
}: AssetRequestApprovalDialogProps) {
  const [comments, setComments] = useState("");
  const [action, setAction] = useState<ApprovalAction | null>(null);
  const { approveAssetRequest, isApproving } = useAssetRequests();

  const handleSubmit = () => {
    if (!requestId || !action) return;

    approveAssetRequest(
      {
        request_id: requestId,
        approval_level: approvalLevel,
        action,
        comments: comments || undefined,
      },
      {
        onSuccess: () => {
          setComments("");
          setAction(null);
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {approvalLevel === "hod"
              ? "HOD Approval"
              : "Procurement Approval"}
          </DialogTitle>
          <DialogDescription>
            Review and approve or reject this asset request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Comments</Label>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add your comments..."
              rows={4}
              className="mt-2"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAction("rejected");
                handleSubmit();
              }}
              disabled={isApproving}
            >
              {isApproving && action === "rejected" && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Reject
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setAction("requested_changes");
                handleSubmit();
              }}
              disabled={isApproving}
            >
              {isApproving && action === "requested_changes" && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Request Changes
            </Button>
            <Button
              onClick={() => {
                setAction("approved");
                handleSubmit();
              }}
              disabled={isApproving}
            >
              {isApproving && action === "approved" && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Approve
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
