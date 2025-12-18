import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateProject,
  useUpdateProject,
} from "@/hooks/construction/useProjectMutations";
import {
  ConstructionProject,
  CreateProjectData,
  PROJECT_STATUSES,
  PROJECT_TYPES,
} from "@/types/construction";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProject: ConstructionProject | null;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  editingProject,
}: CreateProjectDialogProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const isEditing = !!editingProject;

  const [formData, setFormData] = useState<CreateProjectData>({
    project_name: "",
    description: "",
    client_name: "",
    client_contact: "",
    project_type: undefined,
    status: "planning",
    start_date: "",
    target_end_date: "",
    estimated_budget: undefined,
    address: "",
    city: "",
    state: "",
    country: "",
    contract_number: "",
    contract_value: undefined,
    notes: "",
  });

  useEffect(() => {
    if (editingProject) {
      setFormData({
        project_name: editingProject.project_name,
        description: editingProject.description || "",
        client_name: editingProject.client_name || "",
        client_contact: editingProject.client_contact || "",
        project_type: editingProject.project_type || undefined,
        status: editingProject.status,
        start_date: editingProject.start_date || "",
        target_end_date: editingProject.target_end_date || "",
        estimated_budget: editingProject.estimated_budget || undefined,
        address: editingProject.address || "",
        city: editingProject.city || "",
        state: editingProject.state || "",
        country: editingProject.country || "",
        contract_number: editingProject.contract_number || "",
        contract_value: editingProject.contract_value || undefined,
        notes: editingProject.notes || "",
      });
    } else {
      setFormData({
        project_name: "",
        description: "",
        client_name: "",
        client_contact: "",
        project_type: undefined,
        status: "planning",
        start_date: "",
        target_end_date: "",
        estimated_budget: undefined,
        address: "",
        city: "",
        state: "",
        country: "",
        contract_number: "",
        contract_value: undefined,
        notes: "",
      });
    }
  }, [editingProject, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      ...formData,
      estimated_budget: formData.estimated_budget || null,
      contract_value: formData.contract_value || null,
    };

    if (isEditing) {
      await updateProject.mutateAsync({ id: editingProject.id, ...submitData });
    } else {
      await createProject.mutateAsync(submitData);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Project" : "Create New Project"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="project_name">Project Name *</Label>
              <Input
                id="project_name"
                value={formData.project_name}
                onChange={(e) =>
                  setFormData({ ...formData, project_name: e.target.value })
                }
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="client_name">Client Name</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) =>
                  setFormData({ ...formData, client_name: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="client_contact">Client Contact</Label>
              <Input
                id="client_contact"
                value={formData.client_contact}
                onChange={(e) =>
                  setFormData({ ...formData, client_contact: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="project_type">Project Type</Label>
              <Select
                value={formData.project_type || ""}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    project_type: value as any,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status || "planning"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status: value as any,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="target_end_date">Target End Date</Label>
              <Input
                id="target_end_date"
                type="date"
                value={formData.target_end_date}
                onChange={(e) =>
                  setFormData({ ...formData, target_end_date: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="estimated_budget">Estimated Budget</Label>
              <Input
                id="estimated_budget"
                type="number"
                value={formData.estimated_budget || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estimated_budget: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="contract_value">Contract Value</Label>
              <Input
                id="contract_value"
                type="number"
                value={formData.contract_value || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contract_value: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="contract_number">Contract Number</Label>
              <Input
                id="contract_number"
                value={formData.contract_number}
                onChange={(e) =>
                  setFormData({ ...formData, contract_number: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) =>
                  setFormData({ ...formData, state: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProject.isPending || updateProject.isPending}
            >
              {createProject.isPending || updateProject.isPending
                ? "Saving..."
                : isEditing
                ? "Update Project"
                : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
