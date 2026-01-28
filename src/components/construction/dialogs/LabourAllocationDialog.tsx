import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateLabourMaster } from "@/hooks/construction/useLabourMaster";
import { useProjects } from "@/hooks/construction/useProjects";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import type { LabourMaster } from "@/types/construction";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  project_id: z.string().optional().nullable(),
  location_id: z.string().optional().nullable(),
  trade: z.string().optional(),
  skill_level: z.string().optional(),
  hourly_rate: z.coerce.number().optional(),
  daily_rate: z.coerce.number().optional(),
  status: z.string().default("active"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface LabourAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labour: LabourMaster | null;
}

export function LabourAllocationDialog({ open, onOpenChange, labour }: LabourAllocationDialogProps) {
  const updateMutation = useUpdateLabourMaster();
  const { data: projects = [] } = useProjects();
  const { locations: warehouseLocations = [] } = useWarehouseLocations();

  // Filter to only active projects
  const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'planning');
  
  // Filter to active top-level locations
  const activeLocations = warehouseLocations.filter(loc => 
    loc.type === 'location' && loc.status === 'active'
  );

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      project_id: undefined,
      location_id: undefined,
      trade: "",
      skill_level: "", 
      hourly_rate: 0, 
      daily_rate: 0, 
      status: "active", 
      notes: "" 
    },
  });

  useEffect(() => {
    if (labour) {
      form.reset({ 
        project_id: labour.project_id || undefined,
        location_id: labour.location_id || undefined,
        trade: labour.trade || "",
        skill_level: labour.skill_level || "", 
        hourly_rate: labour.hourly_rate || 0, 
        daily_rate: labour.daily_rate || 0, 
        status: labour.status, 
        notes: labour.notes || "" 
      });
    } else {
      form.reset({ 
        project_id: undefined,
        location_id: undefined,
        trade: "",
        skill_level: "", 
        hourly_rate: 0, 
        daily_rate: 0, 
        status: "active", 
        notes: "" 
      });
    }
  }, [labour, form]);

  const onSubmit = async (data: FormData) => {
    if (!labour) return;

    await updateMutation.mutateAsync({ 
      id: labour.id, 
      project_id: data.project_id || null,
      location_id: data.location_id || null,
      trade: data.trade,
      skill_level: data.skill_level,
      hourly_rate: data.hourly_rate,
      daily_rate: data.daily_rate,
      status: data.status,
      notes: data.notes,
    });
    onOpenChange(false);
  };

  if (!labour) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Labour Allocation</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Read-only Identity Fields */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm font-medium text-muted-foreground mb-3">Labour Identity (Read-only)</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Employee ID</label>
                  <Input value={labour.employee_id || "-"} disabled className="bg-muted h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">EPF No</label>
                  <Input value={labour.epf_no || "-"} disabled className="bg-muted h-9" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Employee Name</label>
                <Input value={labour.name} disabled className="bg-muted h-9" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <div className="h-9 flex items-center">
                    {labour.category ? (
                      <Badge variant="outline">{labour.category}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Company</label>
                  <div className="h-9 flex items-center">
                    {labour.labour_company ? (
                      <Badge variant="secondary">{labour.labour_company}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Editable Allocation Fields */}
            <div className="space-y-4 pt-2">
              <p className="text-sm font-medium">Allocation Details</p>
              
              {/* Project Dropdown */}
              <FormField 
                control={form.control} 
                name="project_id" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} 
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No Project Assigned</SelectItem>
                        {activeProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.project_code} - {project.project_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} 
              />

              {/* Location Dropdown */}
              <FormField 
                control={form.control} 
                name="location_id" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} 
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No Location Assigned</SelectItem>
                        {activeLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.location_code ? `${location.location_code} - ` : ''}{location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} 
              />

              <FormField 
                control={form.control} 
                name="trade" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trade</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., Electrician, Mason" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />

              <FormField 
                control={form.control} 
                name="skill_level" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skill Level</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., Senior, Junior" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField 
                  control={form.control} 
                  name="hourly_rate" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hourly Rate</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} 
                />
                <FormField 
                  control={form.control} 
                  name="daily_rate" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily Rate</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} 
                />
              </div>

              <FormField 
                control={form.control} 
                name="status" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} 
              />

              <FormField 
                control={form.control} 
                name="notes" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea {...field} placeholder="Allocation notes..." /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} className="w-full sm:w-auto">
                Update Allocation
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}