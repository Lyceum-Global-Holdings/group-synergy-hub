import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConstructionProject, PROJECT_STATUSES } from "@/types/construction";
import { format } from "date-fns";
import {
  Building2,
  Calendar,
  DollarSign,
  MapPin,
  User,
  FileText,
  Percent,
} from "lucide-react";

interface ProjectDetailsDialogProps {
  project: ConstructionProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailsDialog({
  project,
  open,
  onOpenChange,
}: ProjectDetailsDialogProps) {
  if (!project) return null;

  const statusConfig = PROJECT_STATUSES.find((s) => s.value === project.status);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "MMM d, yyyy");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {project.project_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Progress */}
          <div className="flex items-center justify-between">
            <Badge className={statusConfig?.color || "bg-gray-100 text-gray-800"}>
              {statusConfig?.label || project.status}
            </Badge>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Progress:</span>
              <div className="w-32 bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${project.completion_percentage || 0}%` }}
                />
              </div>
              <span className="text-sm font-medium">
                {project.completion_percentage || 0}%
              </span>
            </div>
          </div>

          <Separator />

          {/* Basic Information */}
          <div>
            <h3 className="font-semibold mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Project Code:</span>
                <p className="font-medium">{project.project_code}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Project Type:</span>
                <p className="font-medium capitalize">
                  {project.project_type || "-"}
                </p>
              </div>
              {project.description && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Description:</span>
                  <p className="font-medium">{project.description}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Client Information */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Client Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Client Name:</span>
                <p className="font-medium">{project.client_name || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Client Contact:</span>
                <p className="font-medium">{project.client_contact || "-"}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timeline
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Start Date:</span>
                <p className="font-medium">{formatDate(project.start_date)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Target End:</span>
                <p className="font-medium">
                  {formatDate(project.target_end_date)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Actual End:</span>
                <p className="font-medium">
                  {formatDate(project.actual_end_date)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Financial */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financial
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Estimated Budget:</span>
                <p className="font-medium">
                  {formatCurrency(project.estimated_budget)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Actual Cost:</span>
                <p className="font-medium">
                  {formatCurrency(project.actual_cost)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Contract Number:</span>
                <p className="font-medium">{project.contract_number || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Contract Value:</span>
                <p className="font-medium">
                  {formatCurrency(project.contract_value)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Location */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <span className="text-muted-foreground">Address:</span>
                <p className="font-medium">{project.address || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">City:</span>
                <p className="font-medium">{project.city || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">State:</span>
                <p className="font-medium">{project.state || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Country:</span>
                <p className="font-medium">{project.country || "-"}</p>
              </div>
            </div>
          </div>

          {project.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </h3>
                <p className="text-sm">{project.notes}</p>
              </div>
            </>
          )}

          {/* Timestamps */}
          <Separator />
          <div className="text-xs text-muted-foreground">
            <p>Created: {format(new Date(project.created_at), "PPpp")}</p>
            <p>Updated: {format(new Date(project.updated_at), "PPpp")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
