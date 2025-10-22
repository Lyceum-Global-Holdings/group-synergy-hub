import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { usePermissions, useCreateRole } from '@/hooks/useUsers';
import { useAssignModulesToRole } from '@/hooks/useModuleAccess';
import { moduleConfig } from '@/constants/moduleConfig';
import { Loader2 } from 'lucide-react';

// Available departments
const departments = [
  'Engineering',
  'Product', 
  'Design',
  'Marketing',
  'Sales',
  'Customer Success',
  'Operations',
  'Finance',
  'Human Resources',
  'Legal',
  'IT',
  'General',
];

// Available app role levels
const appRoles = [
  { value: 'user', label: 'User' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];

const roleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters'),
  department: z.string().min(1, 'Please select a department'),
  app_role: z.string().min(1, 'Please select an app role level'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  permissions: z.array(z.string()).min(1, 'At least one permission must be selected'),
  modules: z.record(z.array(z.string())).optional(),
});

type RoleFormData = z.infer<typeof roleSchema>;

interface AddRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleAdded: () => void;
}

export function AddRoleDialog({ open, onOpenChange, onRoleAdded }: AddRoleDialogProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<Record<string, string[]>>({});
  const { toast } = useToast();
  
  const { data: permissions = [], isLoading: permissionsLoading } = usePermissions();
  const createRole = useCreateRole();
  const assignModulesToRole = useAssignModulesToRole();

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      department: '',
      app_role: '',
      description: '',
      permissions: [],
      modules: {},
    },
  });

  const onSubmit = async (data: RoleFormData) => {
    try {
      const result = await createRole.mutateAsync({
        name: data.name,
        department: data.department,
        app_role: data.app_role,
        description: data.description,
        permissions: data.permissions,
      });

      // Assign modules to the newly created role
      if (result && Object.keys(selectedModules).length > 0) {
        await assignModulesToRole.mutateAsync({
          roleId: result.id,
          modules: selectedModules,
        });
      }

      // Show success message
      toast({
        title: 'Role created successfully',
        description: `${data.name} role has been created with ${data.permissions.length} permissions.`,
      });

      // Call callback and reset form
      onRoleAdded();
      form.reset();
      setSelectedPermissions([]);
      setSelectedModules({});
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error creating role',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    let newPermissions: string[];
    if (checked) {
      newPermissions = [...selectedPermissions, permission];
    } else {
      newPermissions = selectedPermissions.filter(p => p !== permission);
    }
    setSelectedPermissions(newPermissions);
    form.setValue('permissions', newPermissions);
  };

  const handleModuleToggle = (moduleKey: string, checked: boolean) => {
    const newModules = { ...selectedModules };
    if (checked) {
      const config = moduleConfig[moduleKey];
      newModules[moduleKey] = config?.subModules.map(sub => sub.key) || [];
    } else {
      delete newModules[moduleKey];
    }
    setSelectedModules(newModules);
    form.setValue('modules', newModules);
  };

  const handleSubModuleToggle = (moduleKey: string, subModuleKey: string, checked: boolean) => {
    const newModules = { ...selectedModules };
    if (!newModules[moduleKey]) {
      newModules[moduleKey] = [];
    }
    
    if (checked) {
      if (!newModules[moduleKey].includes(subModuleKey)) {
        newModules[moduleKey] = [...newModules[moduleKey], subModuleKey];
      }
    } else {
      newModules[moduleKey] = newModules[moduleKey].filter(key => key !== subModuleKey);
      if (newModules[moduleKey].length === 0) {
        delete newModules[moduleKey];
      }
    }
    
    setSelectedModules(newModules);
    form.setValue('modules', newModules);
  };

  const handleSelectAllInCategory = (category: string, categoryPermissions: any[]) => {
    const categoryIds = categoryPermissions.map(p => p.id);
    const allSelected = categoryIds.every(id => selectedPermissions.includes(id));
    
    if (allSelected) {
      const newPermissions = selectedPermissions.filter(id => !categoryIds.includes(id));
      setSelectedPermissions(newPermissions);
      form.setValue("permissions", newPermissions);
    } else {
      const newPermissions = [...new Set([...selectedPermissions, ...categoryIds])];
      setSelectedPermissions(newPermissions);
      form.setValue("permissions", newPermissions);
    }
  };

  const isSubmitting = createRole.isPending;

  // Group permissions by category for better organization
  const groupedPermissions = permissions.reduce((acc: any, permission) => {
    const category = permission.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
          <DialogDescription>
            Define a new role with specific permissions and access level.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Senior Manager" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
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
              name="app_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Level</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {appRoles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the role responsibilities and scope..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="modules"
              render={() => (
                <FormItem>
                  <FormLabel>Module Access</FormLabel>
                  <FormDescription>
                    Select which modules users with this role can access
                  </FormDescription>
                  <Accordion type="multiple" className="w-full">
                    {Object.entries(moduleConfig).map(([key, config]) => {
                      const isModuleSelected = !!selectedModules[key];
                      const selectedSubModules = selectedModules[key] || [];
                      
                      return (
                        <AccordionItem key={key} value={key}>
                          <AccordionTrigger>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={isModuleSelected}
                                onCheckedChange={(checked) => handleModuleToggle(key, !!checked)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <config.icon className="h-4 w-4" />
                              <span>{config.name}</span>
                              {isModuleSelected && (
                                <Badge variant="secondary" className="ml-2">
                                  {selectedSubModules.length} sub-modules
                                </Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="pl-6 space-y-2 mt-2">
                              {config.subModules.map(sub => (
                                <div key={sub.key} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${key}-${sub.key}`}
                                    checked={selectedSubModules.includes(sub.key)}
                                    onCheckedChange={(checked) => 
                                      handleSubModuleToggle(key, sub.key, !!checked)
                                    }
                                  />
                                  <label
                                    htmlFor={`${key}-${sub.key}`}
                                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    {sub.name}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="permissions"
              render={() => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between">
                    <span>Permissions</span>
                    <Badge variant="secondary">
                      {selectedPermissions.length} / {permissions.length}
                    </Badge>
                  </FormLabel>
                  <FormDescription>
                    Select the permissions for this role
                  </FormDescription>
                  {permissionsLoading ? (
                    <div className="flex flex-col items-center justify-center p-8 space-y-2">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <p className="text-sm text-muted-foreground">Loading permissions...</p>
                    </div>
                  ) : permissions.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground border rounded-lg">
                      No permissions found. Please contact administrator.
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto space-y-4 border rounded-lg p-4">
                      {Object.entries(groupedPermissions).map(([category, categoryPermissions]: [string, any[]]) => (
                        <div key={category} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium capitalize">{category.replace('_', ' ')}</h4>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectAllInCategory(category, categoryPermissions)}
                            >
                              {categoryPermissions.every(p => selectedPermissions.includes(p.id)) ? "Deselect All" : "Select All"}
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 ml-4">
                            {categoryPermissions.map((permission) => (
                              <div key={permission.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={permission.id}
                                  checked={selectedPermissions.includes(permission.id)}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(permission.id, checked as boolean)
                                  }
                                />
                                <label
                                  htmlFor={permission.id}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  title={permission.description || permission.name}
                                >
                                  {permission.name}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Role
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}