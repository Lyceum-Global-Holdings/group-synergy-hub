import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Play, CheckCircle2, Loader2 } from "lucide-react";
import { useUpdateProductionStage, useDailyEntries } from "@/hooks/useProduction";
import { STAGE_STATUSES } from "@/constants/productionSectors";
import StageCostBreakdown from "./StageCostBreakdown";
import DailyEntryForm from "./DailyEntryForm";
import DailyEntriesTable from "./DailyEntriesTable";

interface Props {
  stage: any;
  targetQty?: number;
}

export default function StageProgressCard({ stage, targetQty = 0 }: Props) {
  const updateStage = useUpdateProductionStage();
  const { data: dailyEntries = [] } = useDailyEntries(stage.id);
  const [isOpen, setIsOpen] = useState(stage.status === "in_progress");

  const statusInfo = STAGE_STATUSES.find((s) => s.value === stage.status);
  const costs = stage.production_stage_costs || [];
  const totalStageCost = costs.reduce((sum: number, c: any) => sum + (Number(c.total_cost) || 0), 0);
  const unitCost = targetQty > 0 ? totalStageCost / targetQty : 0;

  const handleStatusUpdate = (status: string) => {
    updateStage.mutate({ id: stage.id, status });
  };

  const handleSelectDate = () => {};

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
              {unitCost > 0 && <span className="text-xs text-muted-foreground">(Unit: {unitCost.toFixed(2)})</span>}
              <span className="text-sm text-muted-foreground">In: {stage.input_qty} → Out: {stage.output_qty}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="border-t pt-4 space-y-4">
            <div className="flex items-center gap-2">
              {stage.status === "pending" && (
                <Button size="sm" onClick={() => handleStatusUpdate("in_progress")} disabled={updateStage.isPending}>
                  <Play className="mr-1 h-3 w-3" /> Start Stage
                </Button>
              )}
              {stage.status === "in_progress" && (
                <Button size="sm" onClick={() => handleStatusUpdate("completed")} disabled={updateStage.isPending}>
                  {updateStage.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Complete Stage
                </Button>
              )}
            </div>

            {stage.status === "in_progress" && (
              <DailyEntryForm stageId={stage.id} existingEntries={dailyEntries} unitCost={unitCost} />
            )}

            <DailyEntriesTable entries={dailyEntries} onSelectDate={handleSelectDate} unitCost={unitCost} />

            <StageCostBreakdown stageId={stage.id} costs={costs} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
