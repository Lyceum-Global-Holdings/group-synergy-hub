import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useProductionOrder, useUpdateProductionOrder } from "@/hooks/useProduction";
import { PRODUCTION_ORDER_STATUSES } from "@/constants/productionSectors";
import StageProgressCard from "./StageProgressCard";
import StagePipeline from "./StagePipeline";
import { format } from "date-fns";

interface Props {
  orderId: string;
  onBack: () => void;
}

export default function ProductionOrderDetail({ orderId, onBack }: Props) {
  const { data: order, isLoading } = useProductionOrder(orderId);
  const updateOrder = useUpdateProductionOrder();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  // Efficiency: final-stage good output vs target; total wastage across stages.
  const target = order.target_qty || 0;
  const finalOutput = stages.length > 0 ? (stages[stages.length - 1].output_qty || 0) : 0;
  const overallYield = target > 0 ? Math.round((finalOutput / target) * 100) : 0;
  const totalWastage = stages.reduce((sum: number, s: any) => sum + (s.wastage_qty || 0), 0);

  // Selected stage for the detail panel: explicit pick → first in-progress → first.
  const activeStage = stages.find((s: any) => s.status === "in_progress");
  const effectiveSelectedId = selectedId ?? activeStage?.id ?? stages[0]?.id ?? null;
  const selectedStage = stages.find((s: any) => s.id === effectiveSelectedId);

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

      {/* Order Summary — efficiency KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Target", value: target.toLocaleString() },
          { label: "Good output", value: finalOutput.toLocaleString() },
          { label: "Overall yield", value: `${overallYield}%`, accent: overallYield >= 90 ? "text-green-600" : overallYield > 0 ? "text-amber-600" : "" },
          { label: "Wastage", value: totalWastage.toLocaleString(), accent: totalWastage > 0 ? "text-destructive" : "" },
          { label: "Total cost", value: totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 }) },
          { label: "Due", value: order.due_date ? format(new Date(order.due_date), "dd MMM") : "—" },
        ].map((k) => (
          <Card key={k.label}><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-lg font-bold ${k.accent ?? ""}`}>{k.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Stage progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{completedStages}/{stages.length} stages · {progress}%</span>
      </div>

      {/* Stage pipeline board */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Production stages</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <StagePipeline stages={stages} selectedId={effectiveSelectedId} onSelect={setSelectedId} />
          {selectedStage && (
            <StageProgressCard key={selectedStage.id} stage={selectedStage} targetQty={target} defaultOpen companyId={(order as any).company_id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
