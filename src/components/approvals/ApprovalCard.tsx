import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UnifiedApproval } from "@/types/approval";
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  Clock, 
  ShoppingCart,
  FileText,
  Building2,
  Package,
  Boxes,
  AlertTriangle,
  TruckIcon,
  ClipboardList,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ApprovalDetailsDialog } from "./ApprovalDetailsDialog";
import { useNavigate } from "react-router-dom";

interface ApprovalCardProps {
  approval: UnifiedApproval;
}

export function ApprovalCard({ approval }: ApprovalCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const navigate = useNavigate();
  
  const priorityColors = {
    urgent: 'border-l-4 border-l-destructive bg-destructive/5',
    high: 'border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/20',
    medium: 'border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
    low: 'border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20'
  };
  
  const typeIcons = {
    purchase_order: ShoppingCart,
    purchase_requisition: FileText,
    supplier_registration: Building2,
    production_receipt: Package,
    bom: Boxes,
    asset_request: AlertTriangle,
    material_request: ClipboardList,
    stock_transfer: TruckIcon,
    grn: Warehouse,
  };
  
  const Icon = typeIcons[approval.type];
  
  const handleViewDetails = () => {
    navigate(approval.view_url);
  };
  
  return (
    <>
      <Card className={cn(
        "hover:shadow-lg transition-all duration-200",
        priorityColors[approval.priority],
        approval.is_overdue && "ring-2 ring-destructive"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="mt-1">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base font-semibold">{approval.title}</CardTitle>
                <CardDescription className="text-sm mt-1">{approval.description}</CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge 
                variant={approval.priority === 'urgent' ? 'destructive' : 'outline'}
                className={cn(
                  approval.priority === 'high' && 'border-orange-500 text-orange-700 dark:text-orange-400',
                  approval.priority === 'medium' && 'border-yellow-500 text-yellow-700 dark:text-yellow-400'
                )}
              >
                {approval.priority.toUpperCase()}
              </Badge>
              {approval.is_overdue && (
                <Badge variant="destructive" className="text-xs">
                  OVERDUE
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              {approval.amount && (
                <span className="font-semibold text-foreground">
                  {approval.currency} {approval.amount.toLocaleString()}
                </span>
              )}
              {approval.stage && (
                <span className="text-xs text-muted-foreground">
                  Stage: <span className="font-medium">{approval.stage}</span>
                </span>
              )}
            </div>
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {approval.age_days === 0 ? 'Today' : `${approval.age_days} ${approval.age_days === 1 ? 'day' : 'days'} old`}
            </span>
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              className="flex-1"
              onClick={() => setShowDetails(true)}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              className="flex-1"
              onClick={() => setShowDetails(true)}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleViewDetails}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <ApprovalDetailsDialog
        open={showDetails}
        onOpenChange={setShowDetails}
        approval={approval}
      />
    </>
  );
}
