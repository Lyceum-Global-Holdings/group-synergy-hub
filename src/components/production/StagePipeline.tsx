import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PipelineStage {
  id: string;
  stage_name: string;
  status: "pending" | "in_progress" | "completed";
  input_qty: number;
  output_qty: number;
  wastage_qty: number;
}

interface Props {
  stages: PipelineStage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

const STATUS_STYLE: Record<PipelineStage["status"], { ring: string; dot: string; badge: string; label: string }> = {
  completed:   { ring: "border-green-300 dark:border-green-800", dot: "bg-green-500 text-white", badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Completed" },
  in_progress: { ring: "border-amber-300 dark:border-amber-800", dot: "bg-amber-500 text-white", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "In progress" },
  pending:     { ring: "border-border",                          dot: "bg-muted-foreground/25 text-muted-foreground", badge: "bg-muted text-muted-foreground", label: "Pending" },
};

export default function StagePipeline({ stages, selectedId, onSelect }: Props) {
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
      {stages.map((s, i) => {
        const st = STATUS_STYLE[s.status];
        const yieldPct = pct(s.output_qty, s.input_qty);
        const wastePct = pct(s.wastage_qty, s.input_qty);
        const selected = s.id === selectedId;
        return (
          <div key={s.id} className="flex items-stretch">
            <button
              onClick={() => onSelect(s.id)}
              className={cn(
                "min-w-[190px] text-left rounded-xl border-2 bg-card p-3 transition hover:shadow-sm",
                st.ring,
                selected ? "ring-2 ring-primary shadow-sm" : "ring-0",
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={cn("h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold", st.dot)}>
                  {s.status === "completed" ? <Check className="h-3.5 w-3.5" /> :
                   s.status === "in_progress" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                </span>
                <Badge variant="secondary" className={cn("text-[10px] border-0", st.badge)}>{st.label}</Badge>
              </div>
              <p className="font-medium text-sm truncate">{s.stage_name}</p>

              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                <span>In <b className="text-foreground">{s.input_qty}</b></span>
                <ArrowRight className="h-3 w-3" />
                <span>Out <b className="text-foreground">{s.output_qty}</b></span>
              </div>

              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full", s.status === "completed" ? "bg-green-500" : "bg-amber-500")}
                     style={{ width: `${Math.min(100, yieldPct)}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px]">
                <span className="text-green-600">Yield {yieldPct}%</span>
                {s.wastage_qty > 0 && <span className="text-destructive">Waste {wastePct}%</span>}
              </div>
            </button>

            {i < stages.length - 1 && (
              <div className="flex items-center px-1 text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
              </div>
            )}
          </div>
        );
      })}
      {stages.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Circle className="h-4 w-4" /> No stages defined for this order.
        </div>
      )}
    </div>
  );
}
