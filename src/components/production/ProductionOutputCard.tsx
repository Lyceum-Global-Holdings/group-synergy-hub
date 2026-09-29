import { useState } from "react";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinishedGoods } from "@/hooks/useFinishedGoods";
import { useCompany } from "@/contexts/CompanyContext";
import { usePostProductionOutput, useProductionOutputStatus } from "@/hooks/useProductionOutput";

const receiptLabel = { pending: "waiting for approval", approved: "approved: in finished-goods stock", rejected: "rejected" } as const;

/**
 * A completed order's good output goes to finished goods as a production
 * receipt (created by the database), which an admin approves as before.
 */
export default function ProductionOutputCard({ orderId, completed }: { orderId: string; completed: boolean }) {
  const { data: status } = useProductionOutputStatus(orderId, completed);
  const post = usePostProductionOutput();
  const { selectedCompany } = useCompany();
  const { products = [] } = useFinishedGoods(selectedCompany?.id);
  const [finishedGoodId, setFinishedGoodId] = useState<string>();

  if (!completed || !status) return null;
  const receipt = status.receipt;
  const needsChoice = !status.finished_good && (!receipt || receipt.approval_status === "rejected");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><PackageCheck className="h-4 w-4" /> Output to finished goods</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {receipt && (
          <p>
            Production receipt <span className="font-mono">{receipt.batch_number}</span> for {Number(receipt.quantity).toLocaleString()}
            {status.finished_good ? ` × ${status.finished_good.name}` : ""}:{" "}
            <Badge variant={receipt.approval_status === "rejected" ? "destructive" : "secondary"}>{receiptLabel[receipt.approval_status]}</Badge>
          </p>
        )}
        {!receipt && status.output <= 0 && <p className="text-muted-foreground">The last stage recorded no output, so there is nothing to post.</p>}
        {(!receipt || receipt.approval_status === "rejected") && status.output > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            {needsChoice && (
              <div className="min-w-[260px] flex-1 space-y-1">
                <p className="text-muted-foreground">The finished good for this order couldn't be found from its customer PO line, BOM or style number. Choose it:</p>
                <Select value={finishedGoodId} onValueChange={setFinishedGoodId}>
                  <SelectTrigger aria-label="Finished good"><SelectValue placeholder="Finished good" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.product_code} · {p.product_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              size="sm"
              onClick={() => post.mutate({ orderId, finishedGoodId: needsChoice ? finishedGoodId : undefined })}
              disabled={post.isPending || (needsChoice && !finishedGoodId)}
            >
              Post {Number(status.output).toLocaleString()} to finished goods
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
