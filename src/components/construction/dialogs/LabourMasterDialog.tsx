import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateLabourMaster, useUpdateLabourMaster } from "@/hooks/construction/useLabourMaster";
import { useLabourCategories, useLabourCompanies, useCreateLabourCategory, useCreateLabourCompany } from "@/hooks/construction/useLabourLookups";
import type { LabourMaster, CreateLabourMasterData } from "@/types/construction";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  epf_no: z.string().optional(),
  category: z.string().optional(),
  labour_company: z.string().optional(),
  skill_level: z.string().optional(),
  contact_number: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  hourly_rate: z.coerce.number().optional(),
  daily_rate: z.coerce.number().optional(),
  status: z.string().default("active"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface LabourMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labour?: LabourMaster | null;
}

export function LabourMasterDialog({ open, onOpenChange, labour }: LabourMasterDialogProps) {
  const createMutation = useCreateLabourMaster();
  const updateMutation = useUpdateLabourMaster();
  
  const { data: categories = [] } = useLabourCategories();
  const { data: labourCompanies = [] } = useLabourCompanies();
  const createCategoryMutation = useCreateLabourCategory();
  const createCompanyMutation = useCreateLabourCompany();

  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [showNewCompany, setShowNewCompany] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      name: "", 
      epf_no: "",
      category: undefined, 
      labour_company: undefined,
      skill_level: "", 
      contact_number: "", 
      email: "", 
      hourly_rate: 0, 
      daily_rate: 0, 
      status: "active", 
      notes: "" 
    },
  });

  useEffect(() => {
    if (labour) {
      form.reset({ 
        name: labour.name, 
        epf_no: labour.epf_no || "",
        category: labour.category || undefined, 
        labour_company: labour.labour_company || undefined,
        skill_level: labour.skill_level || "", 
        contact_number: labour.contact_number || "", 
        email: labour.email || "", 
        hourly_rate: labour.hourly_rate || 0, 
        daily_rate: labour.daily_rate || 0, 
        status: labour.status, 
        notes: labour.notes || "" 
      });
    } else {
      form.reset({ 
        name: "", 
        epf_no: "",
        category: undefined, 
        labour_company: undefined,
        skill_level: "", 
        contact_number: "", 
        email: "", 
        hourly_rate: 0, 
        daily_rate: 0, 
        status: "active", 
        notes: "" 
      });
    }
  }, [labour, form]);

  const onSubmit = async (data: FormData) => {
    const submitData: CreateLabourMasterData = {
      name: data.name,
      epf_no: data.epf_no,
      category: data.category,
      labour_company: data.labour_company,
      skill_level: data.skill_level,
      contact_number: data.contact_number,
      email: data.email,
      hourly_rate: data.hourly_rate,
      daily_rate: data.daily_rate,
      status: data.status,
      notes: data.notes,
    };

    if (labour) {
      await updateMutation.mutateAsync({ id: labour.id, ...submitData });
    } else {
      await createMutation.mutateAsync(submitData);
    }
    onOpenChange(false);
  };

  const handleAddCategory = async () => {
    if (newCategory.trim()) {
      await createCategoryMutation.mutateAsync(newCategory.trim());
      form.setValue("category", newCategory.trim());
      setNewCategory("");
      setShowNewCategory(false);
    }
  };

  const handleAddCompany = async () => {
    if (newCompany.trim()) {
      await createCompanyMutation.mutateAsync(newCompany.trim());
      form.setValue("labour_company", newCompany.trim());
      setNewCompany("");
      setShowNewCompany(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{labour ? "Edit Labour" : "Add Labour"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Employee ID - Read only, auto-generated */}
            {labour?.employee_id && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Employee ID</label>
                <Input value={labour.employee_id} disabled className="bg-muted" />
              </div>
            )}

            <FormField 
              control={form.control} 
              name="name" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField 
                control={form.control} 
                name="epf_no" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EPF No</FormLabel>
                    <FormControl><Input {...field} placeholder="Enter EPF Number" /></FormControl>
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
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />
            </div>

            {/* Category Dropdown */}
            <FormField 
              control={form.control} 
              name="category" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  {showNewCategory ? (
                    <div className="flex gap-2">
                      <Input 
                        value={newCategory} 
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="Enter new category"
                        className="flex-1"
                      />
                      <Button type="button" size="sm" onClick={handleAddCategory} disabled={createCategoryMutation.isPending}>
                        Add
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setShowNewCategory(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select onValueChange={(val) => {
                      if (val === "__add_new__") {
                        setShowNewCategory(true);
                      } else {
                        field.onChange(val);
                      }
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                        <SelectItem value="__add_new__" className="text-primary font-medium">
                          <span className="flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Add Category
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )} 
            />

            {/* Labour Company Dropdown */}
            <FormField 
              control={form.control} 
              name="labour_company" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  {showNewCompany ? (
                    <div className="flex gap-2">
                      <Input 
                        value={newCompany} 
                        onChange={(e) => setNewCompany(e.target.value)}
                        placeholder="Enter new company"
                        className="flex-1"
                      />
                      <Button type="button" size="sm" onClick={handleAddCompany} disabled={createCompanyMutation.isPending}>
                        Add
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setShowNewCompany(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select onValueChange={(val) => {
                      if (val === "__add_new__") {
                        setShowNewCompany(true);
                      } else {
                        field.onChange(val);
                      }
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {labourCompanies.map((comp) => (
                          <SelectItem key={comp.id} value={comp.name}>{comp.name}</SelectItem>
                        ))}
                        <SelectItem value="__add_new__" className="text-primary font-medium">
                          <span className="flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Add Company
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )} 
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField 
                control={form.control} 
                name="contact_number" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Number</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />
              <FormField 
                control={form.control} 
                name="email" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />
            </div>

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
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="w-full sm:w-auto">
                {labour ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
