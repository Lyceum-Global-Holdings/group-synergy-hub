import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, FileText, User, Calendar, AlertCircle, CheckCircle2, Printer } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { DeliveryNoteDocument } from "./DeliveryNoteDocument";
import { usePickPack } from "@/hooks/usePickPack";

interface FinishedGoodsIssueDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueId: string;
}

export function FinishedGoodsIssueDetailsDialog({
  open,
  onOpenChange,
  issueId,
}: FinishedGoodsIssueDetailsDialogProps) {
  const { data: issue, isLoading } = useQuery({
    queryKey: ['finished-goods-issue', issueId],
    queryFn: async () => {
      const { data: issueData, error: issueError } = await supabase
        .from('finished_goods_issues')
        .select(`
          *,
          sales_orders (
            id,
            order_number,
            customer:customers (
              customer_name,
              customer_code
            )
          )
        `)
        .eq('id', issueId)
        .single();

      if (issueError) throw issueError;

      // Fetch issued by user separately
      let issuedByUser = null;
      if (issueData.issued_by) {
        const { data: userData } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', issueData.issued_by)
          .single();
        issuedByUser = userData;
      }

      return { ...issueData, issued_by_user: issuedByUser };
    },
    enabled: !!issueId && open,
  });

  const { data: issueItems } = useQuery({
    queryKey: ['finished-goods-issue-items', issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finished_goods_issue_items')
        .select(`
          *,
          finished_goods (
            id,
            product_name,
            product_code,
            color,
            size
          ),
          sales_order_items!sales_order_item_id (
            id,
            cpo_item_id,
            customer_po_items!cpo_item_id (
              id,
              item_name,
              description,
              color,
              size
            )
          )
        `)
        .eq('issue_id', issueId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!issueId && open,
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: <Badge variant="outline">Draft</Badge>,
      issued: <Badge className="bg-blue-500">Issued</Badge>,
      accepted: <Badge className="bg-green-500">Accepted</Badge>,
      cancelled: <Badge variant="destructive">Cancelled</Badge>
    };
    return badges[status as keyof typeof badges] || <Badge>{status}</Badge>;
  };

  const [showDeliveryNote, setShowDeliveryNote] = useState(false);
  const { acceptIssue, isAcceptingIssue } = usePickPack();

  const handleAcceptIssue = () => {
    if (!issueId) return;
    acceptIssue({ issueId });
  };

  if (isLoading || !issue) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Finished Goods Issue Details</DialogTitle>
            {getStatusBadge(issue.status)}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span className="font-semibold text-foreground text-lg">{issue.issue_number}</span>
            {issue.issue_date && (
              <span>
                <Calendar className="w-4 h-4 inline mr-1" />
                {format(new Date(issue.issue_date), "PPP")}
              </span>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">
              <FileText className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="items">
              <Package className="w-4 h-4 mr-2" />
              Items ({issueItems?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Issue Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Issue Number:</span>
                    <p className="font-medium">{issue.issue_number}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Issue Date:</span>
                    <p className="font-medium">{format(new Date(issue.issue_date), "PPP")}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <div className="mt-1">{getStatusBadge(issue.status)}</div>
                  </div>
                  {issue.issued_by_user && (
                    <div>
                      <span className="text-sm text-muted-foreground">Issued By:</span>
                      <p className="font-medium flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {issue.issued_by_user.full_name || issue.issued_by_user.email}
                      </p>
                    </div>
                  )}
                </div>

                {issue.sales_orders && (
                  <div className="pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Sales Order:</span>
                    <p className="font-medium">
                      {issue.sales_orders.order_number}
                      {issue.sales_orders.customer && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({issue.sales_orders.customer.customer_name})
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {issue.notes && (
                  <div className="pt-2 border-t">
                    <span className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4" />
                      Notes:
                    </span>
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm italic whitespace-pre-wrap">{issue.notes}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <Package className="w-4 h-4 mr-2" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Items:</span>
                  <span className="font-medium">{issue.total_items || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Issued Items:</span>
                  <span className="font-medium">{issue.issued_items || 0}</span>
                </div>
                {issue.status === 'issued' && (
                  <Badge variant="outline" className="w-full justify-center">
                    Stock Deducted
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              {issue.status === 'issued' && (
                <Button 
                  onClick={handleAcceptIssue}
                  disabled={isAcceptingIssue}
                  className="flex-1"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isAcceptingIssue ? 'Accepting...' : 'Accept Issue'}
                </Button>
              )}
              
              {issue.status === 'accepted' && (
                <>
                  <Button 
                    onClick={() => setShowDeliveryNote(true)}
                    variant="outline"
                    className="flex-1"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Delivery Note
                  </Button>
                  <Button 
                    onClick={() => window.print()}
                    className="flex-1"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Delivery Note
                  </Button>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="items">
            <Card>
              <CardContent className="pt-6">
                {issueItems && issueItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Code</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead className="text-right">Quantity Issued</TableHead>
                        <TableHead>Batch Number</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issueItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">
                            {item.finished_goods?.product_code || '-'}
                          </TableCell>
                          <TableCell>{item.finished_goods?.product_name || 'Unknown'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {item.quantity_issued}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.batch_number || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No items in this issue</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Delivery Note Dialog */}
      <Dialog open={showDeliveryNote} onOpenChange={setShowDeliveryNote}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DeliveryNoteDocument 
            issueId={issueId}
            issueDetails={issue}
            issueItems={issueItems || []}
          />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
