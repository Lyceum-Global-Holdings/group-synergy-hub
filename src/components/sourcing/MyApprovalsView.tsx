import { useState } from "react";
import { format } from "date-fns";
import { Clock, FileText, User, Building } from "lucide-react";
import { useMyPendingApprovals, useApproveStage } from "@/hooks/useApprovalWorkflow";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import ApprovalTimeline from "./ApprovalTimeline";

export default function MyApprovalsView() {
  const { data: approvals, isLoading } = useMyPendingApprovals();
  const approveStage = useApproveStage();

  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [comments, setComments] = useState('');

  const handleApprove = async () => {
    if (!selectedApproval) return;

    await approveStage.mutateAsync({
      registrationId: selectedApproval.registration_request_id,
      stageOrder: selectedApproval.stage_order || 1,
      action: 'approve',
      comments: comments || 'Approved',
    });

    setShowApproveDialog(false);
    setSelectedApproval(null);
    setComments('');
  };

  const handleReject = async () => {
    if (!selectedApproval || !comments.trim()) return;

    await approveStage.mutateAsync({
      registrationId: selectedApproval.registration_request_id,
      stageOrder: selectedApproval.stage_order || 1,
      action: 'reject',
      comments,
    });

    setShowRejectDialog(false);
    setSelectedApproval(null);
    setComments('');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (!approvals || approvals.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Pending Approvals</h3>
          <p className="text-muted-foreground text-center">
            You don't have any supplier registrations awaiting your approval.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">My Approvals</h2>
            <p className="text-muted-foreground">
              {approvals.length} registration{approvals.length !== 1 ? 's' : ''} awaiting your approval
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {approvals.map((approval) => {
            const registration = approval.registration;
            const supplierData = typeof registration?.supplier_data === 'object' ? registration.supplier_data as any : {};
            const supplierName = supplierData?.name || 'Unknown Supplier';
            const supplierType = supplierData?.supplier_type || 'N/A';

            return (
              <Card key={approval.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        {supplierName}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        <Badge variant="outline">{approval.stage}</Badge>
                        <span className="text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(approval.created_at), 'MMM dd, yyyy')}
                        </span>
                      </CardDescription>
                    </div>
                    <Badge>{supplierType}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <p className="font-medium">{supplierData?.email || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <p className="font-medium">{supplierData?.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tax ID:</span>
                        <p className="font-medium">{supplierData?.tax_id || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Request Type:</span>
                        <p className="font-medium capitalize">{registration?.request_type?.replace('_', ' ')}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setSelectedApproval(approval);
                          setShowApproveDialog(true);
                        }}
                        className="flex-1"
                      >
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setSelectedApproval(approval);
                          setShowRejectDialog(true);
                        }}
                        className="flex-1"
                      >
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedApproval(approval)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Registration</DialogTitle>
            <DialogDescription>
              Approve this supplier registration at stage: {selectedApproval?.stage}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="approve-comments">Comments (Optional)</Label>
              <Textarea
                id="approve-comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add any comments about this approval..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveStage.isPending}
            >
              {approveStage.isPending ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Registration</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this supplier registration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reject-reason">Rejection Reason *</Label>
              <Textarea
                id="reject-reason"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Explain why this registration is being rejected..."
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!comments.trim() || approveStage.isPending}
            >
              {approveStage.isPending ? 'Rejecting...' : 'Reject Registration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={!!selectedApproval && !showApproveDialog && !showRejectDialog} onOpenChange={() => setSelectedApproval(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registration Details & Timeline</DialogTitle>
          </DialogHeader>
          {selectedApproval && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {(() => {
                  const sd = typeof selectedApproval.registration?.supplier_data === 'object' ? selectedApproval.registration.supplier_data as any : {};
                  return (
                    <>
                      <div>
                        <span className="text-sm text-muted-foreground">Supplier Name</span>
                        <p className="font-medium">{sd?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Type</span>
                        <p className="font-medium">{sd?.supplier_type || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Email</span>
                        <p className="font-medium">{sd?.email || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Phone</span>
                        <p className="font-medium">{sd?.phone || 'N/A'}</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <ApprovalTimeline registrationId={selectedApproval.registration_request_id} />

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedApproval(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowApproveDialog(true);
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowRejectDialog(true);
                  }}
                >
                  Reject
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
