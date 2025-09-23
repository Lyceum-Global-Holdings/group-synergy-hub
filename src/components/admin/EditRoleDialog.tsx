import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { usePermissions, type Role } from '@/hooks/useUsers';
import { useUpdateRole } from '@/hooks/useUserMutations';
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

const editRoleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters'),
  department: z.string().min(1, 'Please select a department'),
  app_role: z.string().min(1, 'Please select an app role level'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  permissions: z.array(z.string()).min(1, 'At least one permission must be selected'),
});

type EditRoleFormData = z.infer<typeof editRoleSchema>;

interface EditRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  onRoleUpdated: () => void;
}

export function EditRoleDialog({ open, onOpenChange, role, onRoleUpdated }: EditRoleDialogProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const { toast } = useToast();
  
  const { data: permissions = [], isLoading: permissionsLoading } = usePermissions();
  const updateRole = useUpdateRole();

  const form = useForm<EditRoleFormData>({
    resolver: zodResolver(editRoleSchema),
    defaultValues: {
      name: '',
      department: '',
      app_role: '',
      description: '',
      permissions: [],
    },
  });

  // Update form when role changes
  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        department: role.department || '',
        app_role: role.app_role,
        description: role.description || '',
        permissions: role.permissions.map(p => p.id),
      });
      setSelectedPermissions(role.permissions.map(p => p.id));
    }
  }, [role, form]);

  const onSubmit = async (data: EditRoleFormData) => {
    if (!role) return;

    try {
      await updateRole.mutateAsync({
        roleId: role.id,
        roleData: {
          name: data.name,
          department: data.department,
          app_role: data.app_role,
          description: data.description,
          permissions: data.permissions,
        },
      });

      // Call callback and reset form
      onRoleUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error updating role',
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

  const isSubmitting = updateRole.isPending;

  // Group permissions by category for better organization
  const groupedPermissions = permissions.reduce((acc: any, permission) => {
    const category = permission.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {});

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Role</DialogTitle>
          <DialogDescription>
            Update the role details, permissions and access level.
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
              name="permissions"
              render={() => (
                <FormItem>
                  <FormLabel>Permissions</FormLabel>
                  <FormDescription>
                    Select the permissions for this role
                  </FormDescription>
                  {permissionsLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-4">
                      {Object.entries(groupedPermissions).map(([category, categoryPermissions]: [string, any[]]) => (
                        <div key={category} className="space-y-2">
                          <h4 className="text-sm font-medium capitalize">{category.replace('_', ' ')}</h4>
                          <div className="grid grid-cols-2 gap-2 ml-4">
                            {categoryPermissions.map((permission) => (
                              <div key={permission.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit-${permission.id}`}
                                  checked={selectedPermissions.includes(permission.id)}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(permission.id, checked as boolean)
                                  }
                                />
                                <label
                                  htmlFor={`edit-${permission.id}`}
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
                Update Role
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}