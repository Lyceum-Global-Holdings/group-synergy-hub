import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { CustomerPurchaseOrder } from "@/types/customer";
import { useCustomerPurchaseOrders } from "@/hooks/useCustomerPurchaseOrders";
import { useCpoWorkflow } from "@/hooks/useCpoWorkflow";
import CpoApprovalDialog from "./CpoApprovalDialog";
import CreatePrFromCpoDialog from "./CreatePrFromCpoDialog";
import { 
  CheckCircle, 
  XCircle, 
  Send, 
  TrendingUp, 
  FileText, 
  ShoppingCart,
  Clock,
  User,
  MessageSquare
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const statusColors = {
  draft: "default",
  pending_approval: "secondary",
  confirmed: "default",
  rejected: "destructive",
  in_production: "outline",
  delivered: "default",
  completed: "default",
  cancelled: "destructive"
} as const;

interface CustomerPoDetailsDialogProps {
  cpoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CustomerPoDetailsDialog({
  cpoId,
  open,
  onOpenChange,
}: CustomerPoDetailsDialogProps) {
  const navigate = useNavigate();
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [createPrDialogOpen, setCreatePrDialogOpen] = useState(false);

  const { approveCPO, submitForApproval, isApproving, isSubmitting } = useCustomerPurchaseOrders();
  const { workflowTracking, createMaterialDemandFromCPO, createPRFromCPO, isCreatingMaterialDemand, isCreatingPR } = useCpoWorkflow(cpoId);

  const { data: cpo, isLoading, isError, error: cpoError } = useQuery({
    queryKey: ['customer-purchase-order', cpoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_purchase_orders')
        .select(`
          *,
          customer:customers(customer_name, customer_code, contact_person, email, phone),
          items:customer_po_items(*),
          approvals:customer_po_approvals(
            *,
            approver_profile:profiles!customer_po_approvals_approver_id_fkey(full_name, email)
          )
        `)
        .eq('id', cpoId)
        .single();
      
      if (error) throw error;
      return data as any; // Type assertion to handle complex joined data
    },
    enabled: !!cpoId,
  });

  const handleApproval = (action: 'approve' | 'reject') => {
    setApprovalAction(action);
    setApprovalDialogOpen(true);
  };

  const handleApprovalSubmit = (action: 'approved' | 'rejected', comments?: string) => {
    console.log('[CPO] Approval submit clicked', { cpoId, action, comments });
    approveCPO.mutate(
      { id: cpoId, action, comments },
      {
        onSuccess: (data) => {
          console.log('[CPO] Approval success', data);
          setApprovalDialogOpen(false);
        },
        onError: (err: any) => {
          console.error('[CPO] Approval error', err);
        },
      }
    );
  };

  const handleSubmitForApproval = () => {
    console.log('[CPO] Submit for approval clicked', { cpoId });
    submitForApproval.mutate(cpoId, {
      onSuccess: (data) => {
        console.log('[CPO] Submit for approval success', data);
      },
      onError: (err: any) => {
        console.error('[CPO] Submit for approval error', err);
      },
    });
  };

  const handleMaterialDemandPlanning = () => {
    console.log('[CPO] Material demand planning clicked', { cpoId });
    createMaterialDemandFromCPO.mutate(
      { 
        cpoId, 
        analysisDate: new Date().toISOString().split('T')[0] 
      },
      {
        onSuccess: (data) => {
          console.log('[CPO] Material demand created', data);
          setTimeout(() => {
            navigate('/procurement/material-demand-planning', { 
              state: { selectedCpoId: cpoId } 
            });
            onOpenChange(false);
          }, 800);
        },
        onError: (err: any) => {
          console.error('[CPO] Material demand error', err);
        },
      }
    );
  };

  const handleCreatePR = (prData: any) => {
    console.log('[CPO] Create PR clicked', { cpoId, prData });
    createPRFromCPO.mutate(
      {
        cpoId,
        ...prData,
      },
      {
        onSuccess: (data) => {
          console.log('[CPO] PR created', data);
          setCreatePrDialogOpen(false);
        },
        onError: (err: any) => {
          console.error('[CPO] Create PR error', err);
        },
      }
    );
  };

  const canApprove = cpo?.status === 'pending_approval';
  const canSubmitForApproval = cpo?.status === 'draft';
  const canProceedToNextStage = cpo?.status === 'confirmed';

  const getWorkflowStageIcon = (stage: string) => {
    switch (stage) {
      case 'cpo_created': return <FileText className="h-4 w-4" />;
      case 'cpo_approved': return <CheckCircle className="h-4 w-4" />;
      case 'material_demand_planned': return <TrendingUp className="h-4 w-4" />;
      case 'pr_created': return <FileText className="h-4 w-4" />;
      case 'pr_approved': return <CheckCircle className="h-4 w-4" />;
      case 'po_created': return <ShoppingCart className="h-4 w-4" />;
      case 'po_approved': return <CheckCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">Loading...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isError) {
    console.error('[CPO] Failed to load CPO details', cpoError);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Failed to load CPO</DialogTitle>
            <DialogDescription>
              {cpoError?.message || 'An unexpected error occurred while loading the CPO.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!cpo) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Customer PO Details: {cpo.cpo_number}
            <Badge variant={statusColors[cpo.status as keyof typeof statusColors]}>
              {cpo.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            View customer purchase order details and items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Action Buttons */}
          {(canSubmitForApproval || canApprove || canProceedToNextStage) && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {canSubmitForApproval && (
                    <Button 
                      onClick={handleSubmitForApproval}
                      disabled={isSubmitting}
                      className="gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                    </Button>
                  )}
                  
                  {canApprove && (
                    <>
                      <Button 
                        onClick={() => handleApproval('approve')}
                        disabled={isApproving}
                        className="gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleApproval('reject')}
                        disabled={isApproving}
                        className="gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}

                  {canProceedToNextStage && (
                    <>
                      <Button 
                        onClick={handleMaterialDemandPlanning}
                        disabled={isCreatingMaterialDemand}
                        className="gap-2"
                        variant="outline"
                      >
                        <TrendingUp className="h-4 w-4" />
                        {isCreatingMaterialDemand ? 'Processing...' : 'Material Demand Planning'}
                      </Button>
                      <Button 
                        onClick={() => setCreatePrDialogOpen(true)}
                        disabled={isCreatingPR}
                        className="gap-2"
                        variant="outline"
                      >
                        <FileText className="h-4 w-4" />
                        Create Purchase Requisition
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Customer Name</p>
                <p className="font-medium">{cpo.customer?.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customer Code</p>
                <p className="font-medium">{cpo.customer?.customer_code}</p>
              </div>
              {cpo.customer?.contact_person && (
                <div>
                  <p className="text-sm text-muted-foreground">Contact Person</p>
                  <p className="font-medium">{cpo.customer.contact_person}</p>
                </div>
              )}
              {cpo.customer?.email && (
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{cpo.customer.email}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Information */}
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">PO Date</p>
                <p className="font-medium">{new Date(cpo.po_date).toLocaleDateString()}</p>
              </div>
              {cpo.delivery_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Date</p>
                  <p className="font-medium">{new Date(cpo.delivery_date).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-medium text-lg">{formatCurrency(cpo.total_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={statusColors[cpo.status as keyof typeof statusColors]}>
                  {cpo.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              {cpo.notes && (
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium">{cpo.notes}</p>
                </div>
              )}
              {cpo.approved_by && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Approved By</p>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                       <p className="font-medium">
                         {(cpo.approvals?.[0]?.approver_profile as any)?.full_name || 'Admin'}
                       </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Approved Date</p>
                    <p className="font-medium">
                      {new Date(cpo.approved_date!).toLocaleDateString()}
                    </p>
                  </div>
                  {cpo.approval_comments && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground">Approval Comments</p>
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 mt-0.5" />
                        <p className="font-medium">{cpo.approval_comments}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>
                {cpo.items?.length || 0} item(s) in this order
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cpo.items?.map((item, index) => (
                  <div key={item.id}>
                    {index > 0 && <Separator />}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Item Name</p>
                        <p className="font-medium">{item.item_name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Quantity</p>
                        <p className="font-medium">{item.quantity_ordered}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Unit Price</p>
                        <p className="font-medium">{formatCurrency(item.unit_price)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-medium">{formatCurrency(item.total_price)}</p>
                      </div>
                      {item.delivery_date && (
                        <div className="md:col-span-4">
                          <p className="text-sm text-muted-foreground">Delivery Date</p>
                          <p className="font-medium">{new Date(item.delivery_date).toLocaleDateString()}</p>
                        </div>
                      )}
                      <div className="md:col-span-4">
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge variant="outline">
                          {item.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Workflow Tracking */}
          {workflowTracking.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Workflow Progress</CardTitle>
                <CardDescription>
                  Track the progress of this CPO through the procurement workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workflowTracking.map((tracking, index) => (
                    <div key={tracking.id}>
                      {index > 0 && <Separator />}
                      <div className="flex items-start gap-4 py-2">
                        <div className="flex-shrink-0 p-2 rounded-lg bg-muted">
                          {getWorkflowStageIcon(tracking.workflow_stage)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">
                            {tracking.workflow_stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(tracking.stage_completed_at).toLocaleString()}
                          </p>
                          {tracking.notes && (
                            <p className="text-sm mt-1">{tracking.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval History */}
          {cpo.approvals && cpo.approvals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Approval History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cpo.approvals.map((approval, index) => (
                    <div key={approval.id}>
                      {index > 0 && <Separator />}
                      <div className="flex items-start justify-between py-2">
                        <div className="flex items-start gap-2">
                          {approval.action === 'approved' ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                          )}
                          <div>
                             <p className="font-medium">
                               {(approval.approver_profile as any)?.full_name || 'Admin'}
                             </p>
                            <p className="text-sm text-muted-foreground">
                              {approval.action.charAt(0).toUpperCase() + approval.action.slice(1)} - {new Date(approval.created_at).toLocaleString()}
                            </p>
                            {approval.comments && (
                              <p className="text-sm mt-1 p-2 bg-muted rounded">
                                {approval.comments}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <CpoApprovalDialog
          open={approvalDialogOpen}
          onOpenChange={setApprovalDialogOpen}
          onApprove={(comments) => handleApprovalSubmit('approved', comments)}
          onReject={(comments) => handleApprovalSubmit('rejected', comments)}
          isLoading={isApproving}
          action={approvalAction}
          cpoNumber={cpo?.cpo_number || ''}
        />

        <CreatePrFromCpoDialog
          open={createPrDialogOpen}
          onOpenChange={setCreatePrDialogOpen}
          onCreatePR={handleCreatePR}
          isLoading={isCreatingPR}
          cpoNumber={cpo?.cpo_number || ''}
        />
      </DialogContent>
    </Dialog>
  );
}