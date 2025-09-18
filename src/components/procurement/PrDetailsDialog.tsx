import React, { useState } from 'react';
import { format } from 'date-fns';
import { FileText, Calendar, User, DollarSign, Package, MessageSquare, CheckCircle, XCircle, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useSubmitPurchaseRequisition, useApprovePurchaseRequisition } from '@/hooks/usePurchaseRequisitions';
import type { PurchaseRequisition, PrStatus } from '@/types/procurement';

interface PrDetailsDialogProps {
  pr: PurchaseRequisition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<PrStatus, string> = {
  draft: 'bg-gray-500',
  submitted: 'bg-blue-500',
  pending_approval: 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  cancelled: 'bg-gray-400',
};

const priorityColors = {
  low: 'bg-gray-500',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

export function PrDetailsDialog({ pr, open, onOpenChange }: PrDetailsDialogProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState('');
  const submitPrMutation = useSubmitPurchaseRequisition();
  const approvePrMutation = useApprovePurchaseRequisition();

  const canEdit = pr.requested_by === user?.id && pr.status === 'draft';
  const canSubmit = pr.requested_by === user?.id && pr.status === 'draft';
  const canApprove = user?.id && pr.status === 'submitted'; // In real app, check if user has approval permissions

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: PrStatus) => (
    <Badge className={`${statusColors[status]} text-white`}>
      {status.replace('_', ' ').toUpperCase()}
    </Badge>
  );

  const getPriorityBadge = (priority: string) => (
    <Badge className={`${priorityColors[priority as keyof typeof priorityColors]} text-white`}>
      {priority.toUpperCase()}
    </Badge>
  );

  const handleSubmit = async () => {
    try {
      await submitPrMutation.mutateAsync(pr.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting PR:', error);
    }
  };

  const handleApproval = async (action: 'approved' | 'rejected') => {
    try {
      await approvePrMutation.mutateAsync({
        id: pr.id,
        action,
        comments: comments.trim() || undefined,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error processing PR:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {pr.pr_number}
              </DialogTitle>
              <DialogDescription>{pr.title}</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(pr.status)}
              {getPriorityBadge(pr.priority)}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="items">Items ({pr.items?.length || 0})</TabsTrigger>
            <TabsTrigger value="approvals">Approval History</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">PR Number</Label>
                      <p className="font-medium">{pr.pr_number}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Department</Label>
                      <p>{pr.department || 'Not specified'}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Title</Label>
                    <p>{pr.title}</p>
                  </div>

                  {pr.description && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                      <p className="text-sm">{pr.description}</p>
                    </div>
                  )}

                  {pr.justification && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Justification</Label>
                      <p className="text-sm">{pr.justification}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Request Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Request Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Requested By</Label>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{pr.requested_by_profile?.full_name || pr.requested_by_profile?.email || 'Unknown'}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Requested Date</Label>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(pr.requested_date), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Required Date</Label>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(pr.required_date), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Total Amount</Label>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">{formatCurrency(pr.total_estimated_amount || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {pr.approved_by && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Approved By</Label>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{pr.approved_by_profile?.full_name || pr.approved_by_profile?.email || 'Unknown'}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Approved Date</Label>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{pr.approved_date ? format(new Date(pr.approved_date), 'MMM dd, yyyy') : '-'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {pr.rejection_reason && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Rejection Reason</Label>
                      <p className="text-sm bg-red-50 p-2 rounded border border-red-200">{pr.rejection_reason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Requested Items ({pr.items?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pr.items && pr.items.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Total Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pr.items.map((item, index) => (
                        <TableRow key={item.id || index}>
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell>{item.description || '-'}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unit_of_measure}</TableCell>
                          <TableCell>{formatCurrency(item.estimated_unit_price)}</TableCell>
                          <TableCell>{formatCurrency(item.estimated_total_price)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={5} className="text-right font-medium">
                          Total:
                        </TableCell>
                        <TableCell className="font-bold">
                          {formatCurrency(pr.total_estimated_amount || 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No items found for this purchase requisition.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approvals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Approval History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* This would show approval history - for now showing status timeline */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="font-medium">Purchase Requisition Created</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(pr.created_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>

                  {pr.status !== 'draft' && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="font-medium">Submitted for Approval</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(pr.updated_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  )}

                  {pr.status === 'approved' && pr.approved_date && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="font-medium">Approved</p>
                        <p className="text-sm text-muted-foreground">
                          By {pr.approved_by_profile?.full_name || 'Unknown'} on{' '}
                          {format(new Date(pr.approved_date), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  )}

                  {pr.status === 'rejected' && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="font-medium">Rejected</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(pr.updated_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                        {pr.rejection_reason && (
                          <p className="text-sm bg-red-50 p-2 rounded border border-red-200 mt-2">
                            {pr.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Available Actions</CardTitle>
                <CardDescription>
                  Actions you can perform on this purchase requisition
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {canSubmit && (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Submit for Approval</h4>
                      <p className="text-sm text-muted-foreground">
                        Submit this PR for management approval
                      </p>
                    </div>
                    <Button onClick={handleSubmit} disabled={submitPrMutation.isPending}>
                      Submit PR
                    </Button>
                  </div>
                )}

                {canApprove && (
                  <div className="space-y-4">
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Approval Actions</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Review and provide your decision on this purchase requisition
                      </p>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="comments">Comments (Optional)</Label>
                          <Textarea
                            id="comments"
                            placeholder="Add any comments about this decision..."
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            rows={3}
                          />
                        </div>

                        <div className="flex gap-3">
                          <Button
                            onClick={() => handleApproval('approved')}
                            disabled={approvePrMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleApproval('rejected')}
                            disabled={approvePrMutation.isPending}
                            variant="destructive"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!canEdit && !canSubmit && !canApprove && (
                  <div className="text-center py-8 text-muted-foreground">
                    No actions available for this purchase requisition.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}