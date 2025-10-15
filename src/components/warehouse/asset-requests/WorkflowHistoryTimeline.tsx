import { WorkflowHistoryEntry } from "@/types/assetRequest";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  Package,
  CheckSquare,
  Ban
} from "lucide-react";
import { format } from "date-fns";

interface WorkflowHistoryTimelineProps {
  history: WorkflowHistoryEntry[];
}

const stageConfig = {
  submitted: {
    icon: FileText,
    label: "Submitted",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20"
  },
  hod_approved: {
    icon: CheckCircle,
    label: "HOD Approved",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20"
  },
  hod_rejected: {
    icon: XCircle,
    label: "HOD Rejected",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/20"
  },
  procurement_approved: {
    icon: CheckCircle,
    label: "Procurement Approved",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20"
  },
  procurement_rejected: {
    icon: XCircle,
    label: "Procurement Rejected",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/20"
  },
  delivered: {
    icon: Package,
    label: "Delivered",
    color: "text-blue-600",
    bgColor: "bg-blue-600/10",
    borderColor: "border-blue-600/20"
  },
  received: {
    icon: CheckSquare,
    label: "Receipt Confirmed",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20"
  },
  fulfilled: {
    icon: CheckCircle,
    label: "Fulfilled",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20"
  },
  cancelled: {
    icon: Ban,
    label: "Cancelled",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-muted"
  }
};

export function WorkflowHistoryTimeline({ history }: WorkflowHistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No workflow history available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry, index) => {
        const config = stageConfig[entry.workflow_stage] || {
          icon: Clock,
          label: entry.workflow_stage,
          color: "text-muted-foreground",
          bgColor: "bg-muted",
          borderColor: "border-muted"
        };

        const Icon = config.icon;
        const isLast = index === history.length - 1;

        return (
          <div key={entry.id} className="flex gap-4">
            {/* Timeline Line */}
            <div className="flex flex-col items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${config.bgColor} ${config.borderColor} border-2`}>
                <Icon className={`h-5 w-5 ${config.color}`} />
              </div>
              {!isLast && (
                <div className="w-0.5 h-full min-h-[60px] bg-border mt-2" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-8">
              <Card className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      {config.label}
                      {entry.metadata?.auto_created && (
                        <Badge variant="outline" className="text-xs">
                          Automated
                        </Badge>
                      )}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(entry.performed_at), "PPP 'at' p")}
                    </p>
                  </div>
                  <Badge variant="outline" className={config.bgColor}>
                    {entry.workflow_stage.replace(/_/g, ' ')}
                  </Badge>
                </div>

                {entry.comments && (
                  <p className="text-sm bg-muted/50 p-3 rounded mt-3">
                    {entry.comments}
                  </p>
                )}

                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <div className="mt-3 text-xs text-muted-foreground space-y-1">
                    {entry.metadata.previous_status && (
                      <p>
                        Status: {entry.metadata.previous_status} → {entry.metadata.new_status}
                      </p>
                    )}
                    {entry.metadata.items && (
                      <p>
                        Items affected: {entry.metadata.items.length}
                      </p>
                    )}
                    {entry.metadata.location && (
                      <p>
                        Location: {entry.metadata.location}
                      </p>
                    )}
                    {entry.metadata.assets_count && (
                      <p>
                        Assets created: {entry.metadata.assets_count}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </div>
        );
      })}
    </div>
  );
}
