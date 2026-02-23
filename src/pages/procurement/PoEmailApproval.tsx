import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edgeFunctionClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function PoEmailApproval() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [comments, setComments] = useState("");
  const [poData, setPoData] = useState<any>(null);
  const [tokenData, setTokenData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const token = searchParams.get('token');
  const action = searchParams.get('action') as 'approve' | 'reject' | null;

  useEffect(() => {
    if (!token) {
      setError("Invalid approval link - token missing");
      setLoading(false);
      return;
    }

    loadTokenData();
  }, [token]);

  const loadTokenData = async () => {
    try {
      setLoading(true);
      
      // Validate token
      const { data: tokenInfo, error: tokenError } = await supabase
        .from('po_approval_tokens')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .single();

      if (tokenError || !tokenInfo) {
        setError("Invalid or expired approval token");
        setLoading(false);
        return;
      }

      // Check expiry
      if (new Date(tokenInfo.expires_at) < new Date()) {
        setError("This approval link has expired");
        setLoading(false);
        return;
      }

      setTokenData(tokenInfo);

      // Fetch PO details
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name, email),
          items:po_items(item_name, quantity_ordered, unit_price, total_price, unit_of_measure)
        `)
        .eq('id', tokenInfo.po_id)
        .single();

      if (poError || !po) {
        setError("Purchase order not found");
        setLoading(false);
        return;
      }

      setPoData(po);
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading token data:', err);
      setError(err.message || "Failed to load approval information");
      setLoading(false);
    }
  };

  const handleApproval = async (approvalAction: 'approve' | 'reject') => {
    if (!token || !tokenData) return;

    try {
      setProcessing(true);

      const { data, error, suggestion } = await invokeEdgeFunction('po-email-approval', {
        body: {
          action: 'process_approval',
          token,
          approval_action: approvalAction,
          comments: comments || undefined
        }
      });

      if (error) throw new Error(suggestion || error.message);

      setSuccess(
        approvalAction === 'approve' 
          ? `Purchase order approved successfully. ${data.next_step || ''}` 
          : 'Purchase order rejected successfully.'
      );
      
      toast({
        title: "Success",
        description: data.message,
      });

      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err: any) {
      console.error('Error processing approval:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to process approval",
        variant: "destructive",
      });
      setError(err.message || "Failed to process approval");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading approval details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600">{success}</AlertDescription>
            </Alert>
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Redirecting to home page...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">Purchase Order Approval</CardTitle>
          <p className="text-sm text-muted-foreground">
            Approval Level: {tokenData?.approval_level === 'merchandiser' ? 'Merchandiser' : 'Department Head'}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PO Details */}
          <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
            <div>
              <p className="text-sm font-medium text-muted-foreground">PO Number</p>
              <p className="text-base font-semibold">{poData?.po_number}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Supplier</p>
              <p className="text-base">{poData?.supplier?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">PO Date</p>
              <p className="text-base">{poData?.po_date ? new Date(poData.po_date).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Expected Delivery</p>
              <p className="text-base">
                {poData?.expected_delivery_date ? new Date(poData.expected_delivery_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <h3 className="font-semibold mb-3">Line Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Item</th>
                    <th className="text-center p-3 text-sm font-medium">Quantity</th>
                    <th className="text-right p-3 text-sm font-medium">Unit Price</th>
                    <th className="text-right p-3 text-sm font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {poData?.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="border-t">
                      <td className="p-3 text-sm">{item.item_name}</td>
                      <td className="p-3 text-sm text-center">{item.quantity_ordered} {item.unit_of_measure}</td>
                      <td className="p-3 text-sm text-right">
                        {poData.currency} {item.unit_price.toFixed(2)}
                      </td>
                      <td className="p-3 text-sm text-right">
                        {poData.currency} {item.total_price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-lg font-bold text-right">
                Total Amount: {poData?.currency} {poData?.final_amount?.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <Label htmlFor="comments">Comments (Optional)</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any comments or notes..."
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="destructive"
              onClick={() => handleApproval('reject')}
              disabled={processing}
              className="gap-2"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Reject
            </Button>
            <Button
              onClick={() => handleApproval('approve')}
              disabled={processing}
              className="gap-2"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
