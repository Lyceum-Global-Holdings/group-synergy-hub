import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PurchaseOrder, PoStatus } from "@/types/purchaseOrder";
import { format } from "date-fns";
import { Send, Package, Edit, FileText, Check, X, Clock, FilePlus } from "lucide-react";
import { useSendPurchaseOrder, usePurchaseOrder } from "@/hooks/usePurchaseOrders";
import { useSubmitPurchaseOrder, useApprovePurchaseOrder, usePurchaseOrderApprovals } from "@/hooks/usePurchaseOrderApprovals";
import { 
  useSubmitForMerchandiserApproval, 
  useApprovePOAsMerchandiser, 
  useApprovePOAsDeptHead,
  useRejectPO,
  useSendDeptHeadApprovalEmail
} from "@/hooks/useTwoLevelPoApprovals";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { CreatePoAmendmentDialog } from "@/components/procurement/CreatePoAmendmentDialog";
import { PoAmendmentsTab } from "@/components/procurement/PoAmendmentsTab";
import { useCurrentUserRoles } from "@/hooks/useCurrentUserRoles";
import { PoDocument } from "@/components/procurement/PoDocument";
import { PoDocumentDreamTeam } from "@/components/procurement/PoDocumentDreamTeam";

interface PoDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder;
}

const statusColors: Record<PoStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending_approval: "bg-amber-100 text-amber-800",
  pending_dept_head_approval: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  sent: "bg-blue-100 text-blue-800",
  acknowledged: "bg-yellow-100 text-yellow-800",
  partially_received: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabels: Record<PoStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Merchandiser",
  pending_dept_head_approval: "Pending Dept Head",
  approved: "Approved",
  rejected: "Rejected",
  sent: "Sent",
  acknowledged: "Acknowledged",
  partially_received: "Partially Received",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function PoDetailsDialog({ open, onOpenChange, purchaseOrder }: PoDetailsDialogProps) {
  const [comments, setComments] = useState("");
  const [showAmendmentDialog, setShowAmendmentDialog] = useState(false);
  const [showPdfView, setShowPdfView] = useState(false);
  const [deptHeadEmail, setDeptHeadEmail] = useState("");
  
  // Fetch full PO details including GRNs
  const { data: poDetails, isLoading: isPoLoading } = usePurchaseOrder(purchaseOrder.id);
  const po = poDetails ?? purchaseOrder;
  
  const sendMutation = useSendPurchaseOrder();
  const submitMerchandiserMutation = useSubmitForMerchandiserApproval();
  const approveMerchandiserMutation = useApprovePOAsMerchandiser();
  const approveDeptHeadMutation = useApprovePOAsDeptHead();
  const rejectMutation = useRejectPO();
  const sendDeptHeadEmailMutation = useSendDeptHeadApprovalEmail();
  const { data: approvals = [] } = usePurchaseOrderApprovals(purchaseOrder.id);
  const { data: userRoles = [] } = useCurrentUserRoles();
  
  const isAdmin = userRoles.some(role => role.role === 'admin' || role.role === 'super_admin');
  const isMerchandiser = userRoles.some(role => 
    role.role_name === 'Merchandiser' || 
    role.role?.toLowerCase().includes('merchand')
  );
  const isDeptHead = userRoles.some(role => 
    role.role_name === 'Department Head' || 
    role.role?.toLowerCase().includes('dept') ||
    role.role?.toLowerCase().includes('department')
  );

  const canSubmitForApproval = po.status === 'draft';
  const canMerchandiserApprove = po.status === 'pending_approval' && (isMerchandiser || isAdmin);
  const canDeptHeadApprove = po.status === 'pending_dept_head_approval' && (isDeptHead || isAdmin);
  const canSend = po.status === 'approved';
  const canAmend = !['cancelled', 'completed'].includes(po.status);

  const handleSubmitForApproval = () => {
    submitMerchandiserMutation.mutate({
      poId: purchaseOrder.id
    });
  };

  const handleMerchandiserApprove = () => {
    approveMerchandiserMutation.mutate({
      poId: purchaseOrder.id,
      comments: comments || undefined
    });
    setComments("");
  };

  const handleSendDeptHeadEmail = () => {
    if (!deptHeadEmail) {
      toast({
        title: "Email Required",
        description: "Please provide department head email",
        variant: "destructive",
      });
      return;
    }

    sendDeptHeadEmailMutation.mutate({
      poId: purchaseOrder.id,
      poNumber: purchaseOrder.po_number,
      deptHeadEmail
    });
    setDeptHeadEmail("");
  };

  const handleDeptHeadApprove = () => {
    approveDeptHeadMutation.mutate({
      poId: purchaseOrder.id,
      comments: comments || undefined
    });
    setComments("");
  };

  const handleReject = (level: 'merchandiser' | 'department_head') => {
    if (!comments) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    rejectMutation.mutate({
      poId: purchaseOrder.id,
      reason: comments,
      approvalLevel: level
    });
    setComments("");
  };

  const handleSend = () => {
    sendMutation.mutate(purchaseOrder.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Purchase Order Details</DialogTitle>
              <DialogDescription>
                PO Number: {po.po_number}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[po.status]}>
                {statusLabels[po.status]}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => setShowPdfView(true)}>
                <FileText className="h-4 w-4 mr-2" />
                View/Download PDF
              </Button>
              {canSubmitForApproval && (
                <Button size="sm" onClick={handleSubmitForApproval} disabled={submitMerchandiserMutation.isPending}>
                  <Clock className="h-4 w-4 mr-2" />
                  Submit for Approval
                </Button>
              )}
              {canMerchandiserApprove && (
                <>
                  <Button size="sm" onClick={handleMerchandiserApprove} disabled={approveMerchandiserMutation.isPending}>
                    <Check className="h-4 w-4 mr-2" />
                    Approve (Merchandiser)
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReject('merchandiser')} disabled={rejectMutation.isPending}>
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              {canDeptHeadApprove && (
                <>
                  <Button size="sm" onClick={handleDeptHeadApprove} disabled={approveDeptHeadMutation.isPending}>
                    <Check className="h-4 w-4 mr-2" />
                    Approve (Dept Head)
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReject('department_head')} disabled={rejectMutation.isPending}>
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              {canSend && (
                <Button size="sm" onClick={handleSend} disabled={sendMutation.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  Send PO
                </Button>
              )}
              {canAmend && (
                <Button size="sm" variant="outline" onClick={() => setShowAmendmentDialog(true)}>
                  <FilePlus className="h-4 w-4 mr-2" />
                  Create Amendment
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="grns">GRNs</TabsTrigger>
            <TabsTrigger value="amendments">Amendments</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            {/* PO Header Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Purchase Order Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">PO Number</p>
                      <p className="font-semibold">{po.po_number}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">PO Date</p>
                      <p>{format(new Date(po.po_date), 'MMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Expected Delivery</p>
                      <p>
                        {po.expected_delivery_date 
                          ? format(new Date(po.expected_delivery_date), 'MMM dd, yyyy')
                          : 'Not specified'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Currency</p>
                      <p>{po.currency}</p>
                    </div>
                  </div>
                  {po.pr && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Source PR</p>
                      <p>{po.pr.pr_number} - {po.pr.title}</p>
                    </div>
                  )}
                  {po.payment_terms && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Payment Terms</p>
                      <p>{po.payment_terms}</p>
                    </div>
                  )}
                  {po.delivery_terms && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Delivery Terms</p>
                      <p>{po.delivery_terms}</p>
                    </div>
                  )}
                  {po.approved_by_profile && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Approved By</p>
                      <p>{po.approved_by_profile.full_name || po.approved_by_profile.email}</p>
                    </div>
                  )}
                  {po.approved_date && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Approved Date</p>
                      <p>{format(new Date(po.approved_date), 'MMM dd, yyyy')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Supplier Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Supplier Name</p>
                    <p className="font-semibold">{po.supplier?.name}</p>
                  </div>
                  {po.supplier?.email && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <p>{po.supplier.email}</p>
                    </div>
                  )}
                  {po.supplier?.phone && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Phone</p>
                      <p>{po.supplier.phone}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created By</p>
                    <p>{po.created_by_profile?.full_name || po.created_by_profile?.email}</p>
                  </div>
                  {po.buyer_profile && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Buyer</p>
                      <p>{po.buyer_profile.full_name || po.buyer_profile.email}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Subtotal</p>
                    <p className="text-lg font-semibold">Rs. {po.total_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tax</p>
                    <p className="text-lg font-semibold">Rs. {po.tax_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Discount</p>
                    <p className="text-lg font-semibold">-Rs. {po.discount_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">Rs. {po.final_amount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {po.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{po.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="items" className="space-y-6">
            {/* Items Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Items</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Specifications</TableHead>
                      <TableHead>Qty Ordered</TableHead>
                      <TableHead>Qty Received</TableHead>
                      <TableHead>Qty Pending</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total Price</TableHead>
                      <TableHead>UOM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.item_code ? (
                            <Badge variant="outline" className="text-xs">
                              {item.item_code}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell>{item.specifications || '-'}</TableCell>
                        <TableCell>{item.quantity_ordered}</TableCell>
                        <TableCell>{item.quantity_received}</TableCell>
                        <TableCell>{item.quantity_pending}</TableCell>
                        <TableCell>Rs. {item.unit_price.toLocaleString()}</TableCell>
                        <TableCell>Rs. {item.total_price.toLocaleString()}</TableCell>
                        <TableCell>{item.unit_of_measure}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Delivery History */}
            {po.receipts && po.receipts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Delivery History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {po.receipts.map((receipt) => (
                      <Card key={receipt.id}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">{receipt.receipt_number}</p>
                              <p className="text-sm text-muted-foreground">
                                Received on {format(new Date(receipt.received_date), 'MMM dd, yyyy')} 
                                by {receipt.received_by_profile?.full_name}
                              </p>
                              {receipt.notes && (
                                <p className="text-sm mt-2">{receipt.notes}</p>
                              )}
                            </div>
                            <Badge variant={receipt.status === 'complete' ? 'default' : 'secondary'}>
                              {receipt.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="grns" className="space-y-6">
            {isPoLoading ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Loading GRNs...</p>
                </CardContent>
              </Card>
            ) : po.grns && po.grns.length > 0 ? (
              <div className="space-y-4">
                {po.grns.map((grn) => (
                  <Card key={grn.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{grn.grn_number}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(new Date(grn.grn_date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <Badge className={
                          grn.status === 'approved' ? 'bg-green-100 text-green-800' :
                          grn.status === 'submitted' ? 'bg-amber-100 text-amber-800' :
                          grn.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          grn.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {grn.status.charAt(0).toUpperCase() + grn.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Invoice Number</p>
                          <p className="font-medium">{grn.invoice_number || 'Not provided'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                          <p className="font-semibold text-lg">Rs. {grn.total_value.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Received By</p>
                          <p>{grn.received_by_profile?.full_name || grn.received_by_profile?.email || 'N/A'}</p>
                        </div>
                        {grn.approved_by_profile && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Approved By</p>
                            <p>{grn.approved_by_profile.full_name || grn.approved_by_profile.email}</p>
                          </div>
                        )}
                        {grn.approved_date && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Approved Date</p>
                            <p>{format(new Date(grn.approved_date), 'MMM dd, yyyy')}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Items Received</p>
                          <p>{grn.grn_items?.length || 0} items</p>
                        </div>
                      </div>
                      
                      {grn.grn_items && grn.grn_items.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-muted-foreground mb-2">Items:</p>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Item Name</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Unit Price</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Quality</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {grn.grn_items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>{item.item_name}</TableCell>
                                  <TableCell>{item.quantity_received}</TableCell>
                                  <TableCell>Rs. {item.unit_price.toLocaleString()}</TableCell>
                                  <TableCell>Rs. {item.total_cost.toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Badge variant={
                                      item.quality_status === 'good' ? 'default' :
                                      item.quality_status === 'damaged' ? 'secondary' :
                                      'destructive'
                                    }>
                                      {item.quality_status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No GRNs created for this PO yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="amendments" className="space-y-6">
            <PoAmendmentsTab poId={po.id} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="approvals" className="space-y-6">
            {/* Submit for Approval */}
            {canSubmitForApproval && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Submit for Merchandiser Approval</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This will submit the PO for merchandiser approval. The merchandiser will be able to approve via the Purchase Orders page.
                  </p>
                  <Button onClick={handleSubmitForApproval} disabled={submitMerchandiserMutation.isPending}>
                    <Clock className="h-4 w-4 mr-2" />
                    Submit for Merchandiser Approval
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Merchandiser Approval */}
            {canMerchandiserApprove && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Merchandiser Approval</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="merch-comments">Comments</Label>
                    <Textarea
                      id="merch-comments"
                      placeholder="Add approval comments (optional)"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleMerchandiserApprove} disabled={approveMerchandiserMutation.isPending}>
                      <Check className="h-4 w-4 mr-2" />
                      Approve (Merchandiser)
                    </Button>
                    <Button variant="destructive" onClick={() => handleReject('merchandiser')} disabled={rejectMutation.isPending}>
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Send Department Head Email Section */}
            {po.status === 'pending_dept_head_approval' && (isMerchandiser || isAdmin || po.merchandiser_approved_by) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Send Approval Email to Department Head</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter the department head's email to send them an approval request.
                  </p>
                  <div>
                    <Label htmlFor="dept-head-email">Department Head Email</Label>
                    <input
                      id="dept-head-email"
                      type="email"
                      placeholder="depthead@company.com"
                      value={deptHeadEmail}
                      onChange={(e) => setDeptHeadEmail(e.target.value)}
                      className="w-full mt-2 px-3 py-2 border rounded-md"
                    />
                  </div>
                  <Button 
                    onClick={handleSendDeptHeadEmail}
                    disabled={sendDeptHeadEmailMutation.isPending}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send Approval Email
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Department Head Approval */}
            {canDeptHeadApprove && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Department Head Approval</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="dh-comments">Comments</Label>
                    <Textarea
                      id="dh-comments"
                      placeholder="Add approval comments (optional)"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleDeptHeadApprove} disabled={approveDeptHeadMutation.isPending}>
                      <Check className="h-4 w-4 mr-2" />
                      Final Approve
                    </Button>
                    <Button variant="destructive" onClick={() => handleReject('department_head')} disabled={rejectMutation.isPending}>
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Approval Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Approval Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      po.approval_level >= 1 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {po.approval_level >= 1 ? <Check className="h-4 w-4" /> : '1'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Merchandiser Approval</p>
                      {po.merchandiser_approved_by && (
                        <p className="text-sm text-muted-foreground">
                          Approved on {po.merchandiser_approved_date ? new Date(po.merchandiser_approved_date).toLocaleDateString() : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      po.approval_level >= 2 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {po.approval_level >= 2 ? <Check className="h-4 w-4" /> : '2'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Department Head Approval</p>
                      {po.department_head_approved_by && (
                        <p className="text-sm text-muted-foreground">
                          Approved on {po.department_head_approved_date ? new Date(po.department_head_approved_date).toLocaleDateString() : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Approval History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Approval History</CardTitle>
              </CardHeader>
              <CardContent>
                {approvals.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No approval history available
                  </p>
                ) : (
                  <div className="space-y-4">
                    {approvals.map((approval) => (
                      <div key={approval.id} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0">
                          <Badge className={approval.action === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {approval.action}
                          </Badge>
                          {approval.approval_level && (
                            <Badge variant="outline" className="ml-2">
                              {approval.approval_level}
                            </Badge>
                          )}
                          {approval.approval_method && (
                            <Badge variant="outline" className="ml-2">
                              {approval.approval_method}
                            </Badge>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-medium">
                              {approval.approver_profile?.full_name || approval.approver_profile?.email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(approval.created_at), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                          {approval.comments && (
                            <p className="text-sm text-muted-foreground">{approval.comments}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* PO Amendment Creation Dialog */}
        <CreatePoAmendmentDialog
          open={showAmendmentDialog}
          onOpenChange={setShowAmendmentDialog}
          poId={po.id}
        />

        {/* PDF View Dialog */}
        {showPdfView && (
          <Dialog open={showPdfView} onOpenChange={setShowPdfView}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <PoDocumentDreamTeam 
                purchaseOrder={po} 
                onClose={() => setShowPdfView(false)} 
              />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}