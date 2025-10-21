import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, AlertCircle, User } from "lucide-react";
import { useWorkflowHistory } from "@/hooks/useApprovalWorkflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ApprovalTimelineProps {
  registrationId: string;
}

export default function ApprovalTimeline({ registrationId }: ApprovalTimelineProps) {
  const { data: history, isLoading } = useWorkflowHistory(registrationId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No approval history available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string, action: string | null) => {
    if (status === 'completed') {
      if (action === 'reject') {
        return <XCircle className="h-6 w-6 text-destructive" />;
      }
      return <CheckCircle2 className="h-6 w-6 text-success" />;
    }
    if (status === 'pending') {
      return <Clock className="h-6 w-6 text-warning" />;
    }
    return <AlertCircle className="h-6 w-6 text-muted-foreground" />;
  };

  const getStatusBadge = (status: string, action: string | null) => {
    if (status === 'completed') {
      if (action === 'reject') {
        return <Badge variant="destructive">Rejected</Badge>;
      }
      if (action === 'request_info') {
        return <Badge variant="outline">Info Requested</Badge>;
      }
      return <Badge className="bg-success text-success-foreground">Approved</Badge>;
    }
    if (status === 'pending') {
      return <Badge variant="secondary">Pending</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-6">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

          {history.map((entry, index) => (
            <div key={entry.id} className="relative flex gap-4 pl-10">
              {/* Icon */}
              <div className="absolute left-0 top-0 flex items-center justify-center bg-background">
                {getStatusIcon(entry.status, entry.approval_action)}
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{entry.stage}</h4>
                    {getStatusBadge(entry.status, entry.approval_action)}
                  </div>
                  {entry.time_spent_hours && (
                    <span className="text-xs text-muted-foreground">
                      {entry.time_spent_hours.toFixed(1)}h
                    </span>
                  )}
                </div>

                {entry.approval_comments && (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-sm">{entry.approval_comments}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {entry.approver && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>{entry.approver.full_name}</span>
                    </div>
                  )}
                  {entry.assigned_user && entry.status === 'pending' && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>Assigned to: {entry.assigned_user.full_name}</span>
                    </div>
                  )}
                  {entry.completed_at ? (
                    <span>{format(new Date(entry.completed_at), 'MMM dd, yyyy HH:mm')}</span>
                  ) : (
                    <span>{format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm')}</span>
                  )}
                </div>

                {entry.escalated_to && (
                  <Badge variant="outline" className="border-warning text-warning">
                    Escalated
                  </Badge>
                )}

                {entry.documents_verified && (
                  <Badge variant="outline" className="border-success text-success">
                    Documents Verified
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
