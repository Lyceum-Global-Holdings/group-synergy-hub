import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useProductionOrder, useUpdateProductionOrder } from "@/hooks/useProduction";
import { PRODUCTION_ORDER_STATUSES } from "@/constants/productionSectors";
import StageProgressCard from "./StageProgressCard";
import { format } from "date-fns";

interface Props {
  orderId: string;
  onBack: () => void;
}

export default function ProductionOrderDetail({ orderId, onBack }: Props) {
  const { data: order, isLoading } = useProductionOrder(orderId);
  const updateOrder = useUpdateProductionOrder();

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!order) return <p className="text-center py-8 text-muted-foreground">Order not found</p>;

  const stages = ((order as any).production_order_stages || []).sort((a: any, b: any) => a.sequence_order - b.sequence_order);
  const completedStages = stages.filter((s: any) => s.status === "completed").length;
  const progress = stages.length > 0 ? Math.round((completedStages / stages.length) * 100) : 0;

  const statusInfo = PRODUCTION_ORDER_STATUSES.find((s) => s.value === order.status);
  const cpoItem = (order as any).customer_po_items;

  const totalCost = stages.reduce((sum: number, s: any) => {
    const stageCosts = (s.production_stage_costs || []).reduce((cs: number, c: any) => cs + (Number(c.total_cost) || 0), 0);
    return sum + stageCosts;
  }, 0);

  const handleStatusChange = (status: string) => {
    updateOrder.mutate({ id: orderId, status });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{order.order_number}</h1>
            <Badge variant="outline" className={statusInfo?.color || ""}>{statusInfo?.label || order.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {order.product_name}{order.style_no ? ` · Style: ${order.style_no}` : ""} · {(order as any).production_sectors?.name}
          </p>
          {cpoItem && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {cpoItem.color && <Badge variant="secondary" className="text-xs">{cpoItem.color}</Badge>}
              {cpoItem.size && <Badge variant="secondary" className="text-xs">Size: {cpoItem.size}</Badge>}
              {cpoItem.unit_price != null && (
                <Badge variant="outline" className="text-xs">Unit Price: {Number(cpoItem.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {order.status === "planned" && (
            <Button size="sm" onClick={() => handleStatusChange("in_progress")} disabled={updateOrder.isPending}>Start Production</Button>
          )}
          {order.status === "in_progress" && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange("completed")} disabled={updateOrder.isPending}>Mark Completed</Button>
          )}
          {order.status !== "cancelled" && order.status !== "completed" && (
            <Button size="sm" variant="destructive" onClick={() => handleStatusChange("cancelled")} disabled={updateOrder.isPending}>Cancel</Button>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Target Qty</p>
            <p className="text-lg font-bold">{order.target_qty?.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Progress</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-sm font-bold">{progress}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Cost</p>
            <p className="text-lg font-bold">{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Start Date</p>
            <p className="text-sm font-medium">{order.start_date ? format(new Date(order.start_date), "dd MMM yyyy") : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Due Date</p>
            <p className="text-sm font-medium">{order.due_date ? format(new Date(order.due_date), "dd MMM yyyy") : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stage Pipeline */}
      <Card>
        <CardHeader><CardTitle className="text-base">Production Stages</CardTitle></CardHeader>
        <CardContent>
          {/* Pipeline Stepper */}
          <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
            {stages.map((stage: any, i: number) => (
              <div key={stage.id} className="flex items-center">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors
                  ${stage.status === "completed" ? "bg-green-50 border-green-300 text-green-800 dark:bg-green-900/20 dark:text-green-400" :
                    stage.status === "in_progress" ? "bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400" :
                    "bg-muted/50 border-border text-muted-foreground"}`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${stage.status === "completed" ? "bg-green-500 text-white" :
                      stage.status === "in_progress" ? "bg-amber-500 text-white" : "bg-muted-foreground/20 text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  {stage.stage_name}
                </div>
                {i < stages.length - 1 && <div className="w-8 h-0.5 bg-border mx-1" />}
              </div>
            ))}
          </div>

          {/* Stage Details */}
          <div className="space-y-4">
            {stages.map((stage: any) => (
              <StageProgressCard key={stage.id} stage={stage} targetQty={order.target_qty || 0} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
