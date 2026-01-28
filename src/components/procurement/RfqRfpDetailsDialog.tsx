import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRfqRfpRequest, usePublishRfqRfpRequest } from "@/hooks/useRfqRfp";
import { format } from "date-fns";
import { Calendar, Clock, DollarSign, FileText, Package, Send, Users } from "lucide-react";
import type { RfqRfpRequest } from "@/types/rfqRfp";

interface RfqRfpDetailsDialogProps {
  requestId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RfqRfpDetailsDialog({ requestId, open, onOpenChange }: RfqRfpDetailsDialogProps) {
  const { data: request, isLoading } = useRfqRfpRequest(requestId || undefined);
  const publishMutation = usePublishRfqRfpRequest();

  if (isLoading || !request) {
    return null;
  }

  const handlePublish = () => {
    if (request.id) {
      publishMutation.mutate(request.id);
    }
  };

  const getStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      published: "default",
      in_progress: "default",
      evaluation: "default",
      awarded: "default",
      cancelled: "destructive",
      closed: "secondary",
    };
    return colors[status] || "default";
  };

  const getPriorityColor = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "secondary",
      medium: "default",
      high: "default",
      urgent: "destructive",
    };
    return colors[priority] || "default";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle>{request.title}</DialogTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{request.request_number}</span>
                <span>•</span>
                <span className="uppercase">{request.request_type}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getPriorityColor(request.priority)}>
                {request.priority}
              </Badge>
              <Badge variant={getStatusColor(request.status)}>
                {request.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items ({request.items?.length || 0})</TabsTrigger>
            <TabsTrigger value="quotes">Quotes ({request.quotes?.length || 0})</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Issue Date:</span>
                  <span>{format(new Date(request.issue_date), "PPP")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Submission Deadline:</span>
                  <span>{format(new Date(request.submission_deadline), "PPP p")}</span>
                </div>
                {request.evaluation_deadline && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Evaluation Deadline:</span>
                    <span>{format(new Date(request.evaluation_deadline), "PPP")}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {request.budget_estimate && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Budget Estimate:</span>
                    <span>{request.currency} {request.budget_estimate.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Send className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Publish Type:</span>
                  <Badge variant="outline">{request.publish_type}</Badge>
                </div>
                {request.category && (
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Category:</span>
                    <span>{request.category}</span>
                  </div>
                )}
              </div>
            </div>

            {request.description && (
              <>
                <Separator />
                <div>
                  <h3 className="font-medium mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {request.description}
                  </p>
                </div>
              </>
            )}

            {request.invited_suppliers && request.invited_suppliers.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Invited Suppliers ({request.invited_suppliers.length})
                  </h3>
                  <div className="space-y-2">
                    {request.invited_suppliers.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between text-sm border rounded-lg p-2">
                        <span>{inv.supplier?.name}</span>
                        <Badge variant="outline">{inv.invitation_status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {request.status === "draft" && (
              <div className="flex justify-end">
                <Button onClick={handlePublish} disabled={publishMutation.isPending}>
                  <Send className="w-4 h-4 mr-2" />
                  {publishMutation.isPending ? "Publishing..." : "Publish Request"}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="items">
            {request.items && request.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Est. Unit Price</TableHead>
                    <TableHead>Est. Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.line_number}</TableCell>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit_of_measure}</TableCell>
                      <TableCell>
                        {item.estimated_unit_price
                          ? `${request.currency} ${item.estimated_unit_price.toFixed(2)}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {item.estimated_total_price
                          ? `${request.currency} ${item.estimated_total_price.toFixed(2)}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No items added yet
              </div>
            )}
          </TabsContent>

          <TabsContent value="quotes">
            {request.quotes && request.quotes.length > 0 ? (
              <div className="space-y-4">
                {request.quotes.map((quote) => (
                  <div key={quote.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{quote.supplier?.name}</h4>
                        <p className="text-sm text-muted-foreground">{quote.quote_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {quote.currency} {quote.total_quoted_amount.toLocaleString()}
                        </p>
                        <Badge variant={getStatusColor(quote.status)}>{quote.status}</Badge>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Submitted: {format(new Date(quote.submission_date), "PPP")}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No quotes received yet
              </div>
            )}
          </TabsContent>

          <TabsContent value="requirements" className="space-y-4">
            {request.technical_specifications && (
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Technical Specifications
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {request.technical_specifications}
                </p>
              </div>
            )}

            {request.terms_and_conditions && (
              <div>
                <h3 className="font-medium mb-2">Terms and Conditions</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {request.terms_and_conditions}
                </p>
              </div>
            )}

            {request.delivery_requirements && (
              <div>
                <h3 className="font-medium mb-2">Delivery Requirements</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {request.delivery_requirements}
                </p>
              </div>
            )}

            {request.payment_terms && (
              <div>
                <h3 className="font-medium mb-2">Payment Terms</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {request.payment_terms}
                </p>
              </div>
            )}

            {request.warranty_requirements && (
              <div>
                <h3 className="font-medium mb-2">Warranty Requirements</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {request.warranty_requirements}
                </p>
              </div>
            )}

            {request.compliance_requirements && (
              <div>
                <h3 className="font-medium mb-2">Compliance Requirements</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {request.compliance_requirements}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
