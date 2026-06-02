import { useState } from "react";
import { CheckCircle, XCircle, Eye, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSupplierRegistrations, useApproveRegistration, useRejectRegistration } from "@/hooks/useSupplierRegistration";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import { SupplierRegistrationRequest } from "@/types/supplierRegistration";
import { RegistrationReviewBody } from "./RegistrationReviewBody";

export default function ApprovalDashboard() {
  const { selectedCompany } = useCompany();
  const { data: registrations = [], isLoading } = useSupplierRegistrations(selectedCompany?.id);
  const approveRegistration = useApproveRegistration();
  const rejectRegistration = useRejectRegistration();

  const [selectedRegistration, setSelectedRegistration] = useState<SupplierRegistrationRequest | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const pendingRegistrations = registrations.filter(r => r.status === 'pending_approval');
  const selfServicePending = pendingRegistrations.filter(r => r.request_type === 'self_service');

  const handleApprove = async (id: string) => {
    await approveRegistration.mutateAsync({ id });
    setSelectedRegistration(null);
  };

  const handleReject = async () => {
    if (!selectedRegistration || !rejectionReason.trim()) return;
    
    await rejectRegistration.mutateAsync({
      id: selectedRegistration.id,
      reason: rejectionReason
    });
    
    setShowRejectDialog(false);
    setRejectionReason("");
    setSelectedRegistration(null);
  };

  const RequestCard = ({ registration }: { registration: SupplierRegistrationRequest }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {registration.supplier_data.supplier_name}
              {registration.request_type === 'self_service' && (
                <Badge variant="secondary">Public</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Submitted {registration.submitted_at ? format(new Date(registration.submitted_at), "MMM dd, yyyy 'at' HH:mm") : "-"}
            </CardDescription>
          </div>
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium">Type</p>
              <p className="text-muted-foreground">{registration.supplier_data.supplier_type}</p>
            </div>
            <div>
              <p className="font-medium">Email</p>
              <p className="text-muted-foreground">{registration.supplier_data.email}</p>
            </div>
            <div>
              <p className="font-medium">Phone</p>
              <p className="text-muted-foreground">{registration.supplier_data.phone}</p>
            </div>
            <div>
              <p className="font-medium">City</p>
              <p className="text-muted-foreground">{registration.supplier_data.city || "-"}</p>
            </div>
          </div>

          {registration.supplier_data.business_description && (
            <div>
              <p className="font-medium text-sm mb-1">Business Description</p>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {registration.supplier_data.business_description}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedRegistration(registration)}
            >
              <Eye className="w-4 h-4 mr-2" />
              Review
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleApprove(registration.id)}
              disabled={approveRegistration.isPending}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setSelectedRegistration(registration);
                setShowRejectDialog(true);
              }}
              disabled={rejectRegistration.isPending}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Approval Dashboard</h2>
          <p className="text-muted-foreground">Review and approve supplier registration requests</p>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">
              All Pending ({pendingRegistrations.length})
            </TabsTrigger>
            <TabsTrigger value="self-service">
              Public Registrations ({selfServicePending.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {pendingRegistrations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No pending approvals
                </CardContent>
              </Card>
            ) : (
              pendingRegistrations.map(reg => <RequestCard key={reg.id} registration={reg} />)
            )}
          </TabsContent>

          <TabsContent value="self-service" className="space-y-4 mt-4">
            {selfServicePending.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No public registrations pending
                </CardContent>
              </Card>
            ) : (
              selfServicePending.map(reg => <RequestCard key={reg.id} registration={reg} />)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      {selectedRegistration && !showRejectDialog && (
        <Dialog open={!!selectedRegistration} onOpenChange={() => setSelectedRegistration(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedRegistration.supplier_data.supplier_name}</DialogTitle>
              <DialogDescription>Review complete registration details</DialogDescription>
            </DialogHeader>
            
            <RegistrationReviewBody registration={selectedRegistration} />

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRegistration(null)}>
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
              >
                Reject
              </Button>
              <Button onClick={() => handleApprove(selectedRegistration.id)}>
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
              <Label>Rejection Reason *</Label>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
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
              disabled={!rejectionReason.trim() || rejectRegistration.isPending}
            >
              Reject Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
