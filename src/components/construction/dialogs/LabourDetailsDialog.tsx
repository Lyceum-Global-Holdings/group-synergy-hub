import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useProjects } from "@/hooks/construction/useProjects";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import type { LabourMaster } from "@/types/construction";
import { User, Briefcase, Building2, MapPin, Phone, FileText, FolderKanban, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface LabourDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labour: LabourMaster | null;
}

export function LabourDetailsDialog({
  open,
  onOpenChange,
  labour,
}: LabourDetailsDialogProps) {
  const { data: projects } = useProjects();
  const { locations: warehouseLocations = [] } = useWarehouseLocations();

  if (!labour) return null;

  const project = projects?.find((p) => p.id === labour.project_id);
  const location = warehouseLocations.find((l) => l.id === labour.location_id);

  const DetailRow = ({ label, value, icon: Icon }: { label: string; value: string | number | null | undefined; icon?: React.ElementType }) => (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value ?? "—"}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Labour Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Information */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6">
              <DetailRow label="Employee ID" value={labour.employee_id} icon={FileText} />
              <DetailRow label="Employee Name" value={labour.name} icon={User} />
              <DetailRow label="EPF Number" value={labour.epf_no} />
              <DetailRow label="Email" value={labour.email} />
              <div className="col-span-2 flex items-center gap-2 py-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Badge variant={labour.status === "active" ? "default" : "secondary"}>
                  {labour.status || "active"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Work Information */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Work Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6">
              <DetailRow label="Category" value={labour.category} icon={Briefcase} />
              <DetailRow label="Company" value={labour.labour_company} icon={Building2} />
              <DetailRow label="Trade" value={labour.trade} />
              <DetailRow label="Skill Level" value={labour.skill_level} />
            </CardContent>
          </Card>

          {/* Project & Location Assignment */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                Project & Location Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Project */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assigned Project</p>
                {project ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-primary/10">
                        {project.project_code}
                      </Badge>
                      <span className="font-medium">{project.project_name}</span>
                    </div>
                    {project.address && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {project.address}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No project assigned</p>
                )}
              </div>

              <Separator />

              {/* Location */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assigned Location</p>
                {location ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <div>
                      {location.location_code && (
                        <Badge variant="outline" className="mr-2">
                          {location.location_code}
                        </Badge>
                      )}
                      <span className="font-medium">{location.name}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No location assigned</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Rates Information */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Rates Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6">
              <DetailRow 
                label="Hourly Rate" 
                value={labour.hourly_rate ? `$${labour.hourly_rate.toFixed(2)}` : null} 
                icon={DollarSign} 
              />
              <DetailRow 
                label="Daily Rate" 
                value={labour.daily_rate ? `$${labour.daily_rate.toFixed(2)}` : null} 
              />
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6">
              <DetailRow label="Contact Number" value={labour.contact_number} icon={Phone} />
            </CardContent>
          </Card>

          {/* Notes */}
          {labour.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{labour.notes}</p>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Timestamps */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Created: {labour.created_at ? format(new Date(labour.created_at), "PPp") : "—"}
            </span>
            <span>
              Updated: {labour.updated_at ? format(new Date(labour.updated_at), "PPp") : "—"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}