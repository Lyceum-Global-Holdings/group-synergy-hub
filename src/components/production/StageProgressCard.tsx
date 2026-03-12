import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Play, CheckCircle2, Loader2 } from "lucide-react";
import { useUpdateProductionStage } from "@/hooks/useProduction";
import { STAGE_STATUSES } from "@/constants/productionSectors";
import StageCostBreakdown from "./StageCostBreakdown";

interface Props {
  stage: any;
}

export default function StageProgressCard({ stage }: Props) {
  const updateStage = useUpdateProductionStage();
  const [inputQty, setInputQty] = useState(stage.input_qty || 0);
  const [outputQty, setOutputQty] = useState(stage.output_qty || 0);
  const [wastageQty, setWastageQty] = useState(stage.wastage_qty || 0);
  const [isOpen, setIsOpen] = useState(stage.status === "in_progress");

  const statusInfo = STAGE_STATUSES.find((s) => s.value === stage.status);
  const costs = stage.production_stage_costs || [];
  const totalStageCost = costs.reduce((sum: number, c: any) => sum + (Number(c.total_cost) || 0), 0);

  const handleStatusUpdate = (status: string) => {
    updateStage.mutate({ id: stage.id, status, input_qty: inputQty, output_qty: outputQty, wastage_qty: wastageQty });
  };

  const handleSaveQty = () => {
    updateStage.mutate({ id: stage.id, input_qty: inputQty, output_qty: outputQty, wastage_qty: wastageQty });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-3">
              <span className="font-semibold">{stage.stage_name}</span>
              <Badge variant="outline" className={statusInfo?.color || ""}>{statusInfo?.label}</Badge>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Cost: {totalStageCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className="text-sm text-muted-foreground">In: {stage.input_qty} → Out: {stage.output_qty}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="border-t pt-4 space-y-4">
            {/* Quantity Fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Input Qty</Label>
                <Input type="number" value={inputQty} onChange={(e) => setInputQty(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Output Qty</Label>
                <Input type="number" value={outputQty} onChange={(e) => setOutputQty(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Wastage</Label>
                <Input type="number" value={wastageQty} onChange={(e) => setWastageQty(Number(e.target.value))} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {stage.status === "pending" && (
                <Button size="sm" onClick={() => handleStatusUpdate("in_progress")} disabled={updateStage.isPending}>
                  <Play className="mr-1 h-3 w-3" /> Start Stage
                </Button>
              )}
              {stage.status === "in_progress" && (
                <>
                  <Button size="sm" variant="outline" onClick={handleSaveQty} disabled={updateStage.isPending}>
                    {updateStage.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Save Quantities
                  </Button>
                  <Button size="sm" onClick={() => handleStatusUpdate("completed")} disabled={updateStage.isPending}>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Complete Stage
                  </Button>
                </>
              )}
            </div>

            {/* Cost Breakdown */}
            <StageCostBreakdown stageId={stage.id} costs={costs} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
