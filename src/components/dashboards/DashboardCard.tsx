import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Eye, Edit, Trash2, Share2 } from "lucide-react";
import { Dashboard } from "@/types/dashboard";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface DashboardCardProps {
  dashboard: Dashboard;
  onDelete: () => void;
  onShare: () => void;
}

export function DashboardCard({ dashboard, onDelete, onShare }: DashboardCardProps) {
  const navigate = useNavigate();

  const handleView = () => {
    navigate(`/management/dashboards/${dashboard.id}`);
  };

  const handleEdit = () => {
    navigate(`/management/dashboards/${dashboard.id}/edit`);
  };
  const getVisibilityBadge = () => {
    switch (dashboard.visibility) {
      case "company_wide":
        return <Badge variant="secondary">Company Wide</Badge>;
      case "role_based":
        return <Badge variant="outline">Role Based</Badge>;
      case "private":
        return <Badge>Private</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">{dashboard.name}</CardTitle>
              {dashboard.is_default && (
                <Badge variant="outline" className="mt-1">Default</Badge>
              )}
            </div>
          </div>
          {getVisibilityBadge()}
        </div>
        {dashboard.description && (
          <CardDescription>{dashboard.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          Created {formatDistanceToNow(new Date(dashboard.created_at), { addSuffix: true })}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button size="sm" onClick={handleView}>
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
        <Button size="sm" variant="outline" onClick={handleEdit}>
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
        <Button size="sm" variant="outline" onClick={onShare}>
          <Share2 className="h-4 w-4 mr-1" />
          Share
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
