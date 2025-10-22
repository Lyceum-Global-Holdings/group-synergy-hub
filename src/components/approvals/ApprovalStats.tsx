import { useMemo } from "react";
import { Card, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { UnifiedApproval } from "@/types/approval";
import { AlertCircle, Clock, Zap, Calendar } from "lucide-react";

interface ApprovalStatsProps {
  approvals: UnifiedApproval[];
}

export function ApprovalStats({ approvals }: ApprovalStatsProps) {
  const stats = useMemo(() => {
    const total = approvals.length;
    const urgent = approvals.filter(a => a.priority === 'urgent').length;
    const overdue = approvals.filter(a => a.is_overdue).length;
    const today = approvals.filter(a => a.age_days === 0).length;
    
    const byType = approvals.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const totalAmount = approvals
      .filter(a => a.amount)
      .reduce((sum, a) => sum + (a.amount || 0), 0);
    
    return { total, urgent, overdue, today, byType, totalAmount };
  }, [approvals]);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardDescription className="text-sm font-medium">Total Pending</CardDescription>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold">{stats.total}</CardTitle>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardDescription className="text-sm font-medium">Urgent</CardDescription>
            <Zap className="h-4 w-4 text-destructive" />
          </div>
          <CardTitle className="text-3xl font-bold text-destructive">{stats.urgent}</CardTitle>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardDescription className="text-sm font-medium">Overdue</CardDescription>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </div>
          <CardTitle className="text-3xl font-bold text-orange-600">{stats.overdue}</CardTitle>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardDescription className="text-sm font-medium">Received Today</CardDescription>
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">{stats.today}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
