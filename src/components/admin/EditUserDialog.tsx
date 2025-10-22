import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompanies } from "@/hooks/useCompanies";
import { useRoles, useUpdateProfile, useAssignRole, useRemoveRole, type User } from "@/hooks/useUsers";
import { useUserModules, useAssignModulesToUser, useRemoveUserModule } from "@/hooks/useModuleAccess";
import { moduleConfig } from "@/constants/moduleConfig";

const editUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  department: z.string().optional(),
  company: z.string().min(1, "Company is required"),
  roles: z.array(z.string()),
  grantedModules: z.array(z.string()).optional(),
  deniedModules: z.array(z.string()).optional(),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onUserUpdated?: () => void;
}

export const EditUserDialog: React.FC<EditUserDialogProps> = ({
  open,
  onOpenChange,
  user,
  onUserUpdated,
}) => {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [grantedModules, setGrantedModules] = useState<string[]>([]);
  const [deniedModules, setDeniedModules] = useState<string[]>([]);
  const [inheritedModules, setInheritedModules] = useState<string[]>([]);
  const { toast } = useToast();
  
  const { companies } = useCompanies();
  const { data: roles } = useRoles();
  const { data: userModules = [] } = useUserModules(user?.id);
  const updateProfile = useUpdateProfile();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();
  const assignModulesToUser = useAssignModulesToUser();
  const removeUserModule = useRemoveUserModule();

  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      department: "",
      company: "",
      roles: [],
      grantedModules: [],
      deniedModules: [],
    },
  });

  // Update form when user changes
  useEffect(() => {
    if (user) {
      const [firstName, lastName] = (user.full_name || "").split(" ", 2);
      form.reset({
        firstName: firstName || "",
        lastName: lastName || "",
        department: user.department || "",
        company: user.company_id || "",
        roles: user.roles.map(r => r.id),
        grantedModules: [],
        deniedModules: [],
      });
      setSelectedRoles(user.roles.map(r => r.id));
    }
  }, [user, form]);

  // Load user's module overrides
  useEffect(() => {
    if (userModules.length > 0) {
      const granted = userModules.filter(um => um.access_type === 'grant').map(um => um.module_key);
      const denied = userModules.filter(um => um.access_type === 'deny').map(um => um.module_key);
      setGrantedModules(granted);
      setDeniedModules(denied);
      form.setValue('grantedModules', granted);
      form.setValue('deniedModules', denied);
    }
  }, [userModules, form]);

  // Calculate inherited modules from selected roles
  useEffect(() => {
    const selectedRoleObjects = roles?.filter(r => selectedRoles.includes(r.id)) || [];
    const moduleSet = new Set<string>();
    
    selectedRoleObjects.forEach(() => {
      Object.keys(moduleConfig).forEach(key => moduleSet.add(key));
    });
    
    setInheritedModules(Array.from(moduleSet));
  }, [selectedRoles, roles]);

  const onSubmit = async (data: EditUserFormData) => {
    if (!user) return;

    try {
      // Update profile
      await updateProfile.mutateAsync({
        userId: user.id,
        updates: {
          full_name: `${data.firstName} ${data.lastName}`,
          department: data.department,
        },
      });

      // Handle role changes
      const currentRoleIds = user.roles.map(r => r.id);
      const rolesToAdd = selectedRoles.filter(roleId => !currentRoleIds.includes(roleId));
      const rolesToRemove = currentRoleIds.filter(roleId => !selectedRoles.includes(roleId));

      for (const roleId of rolesToAdd) {
        await assignRole.mutateAsync({ userId: user.id, roleId });
      }

      for (const roleId of rolesToRemove) {
        await removeRole.mutateAsync({ userId: user.id, roleId });
      }

      // Handle module overrides
      const originalGranted = userModules.filter(um => um.access_type === 'grant').map(um => um.module_key);
      const originalDenied = userModules.filter(um => um.access_type === 'deny').map(um => um.module_key);

      // Remove modules that are no longer in the lists
      for (const moduleKey of originalGranted) {
        if (!grantedModules.includes(moduleKey)) {
          await removeUserModule.mutateAsync({ userId: user.id, moduleKey });
        }
      }
      for (const moduleKey of originalDenied) {
        if (!deniedModules.includes(moduleKey)) {
          await removeUserModule.mutateAsync({ userId: user.id, moduleKey });
        }
      }

      // Add new granted modules
      for (const moduleKey of grantedModules) {
        if (!originalGranted.includes(moduleKey)) {
          const config = moduleConfig[moduleKey];
          await assignModulesToUser.mutateAsync({
            userId: user.id,
            moduleKey,
            submodules: config?.subModules.map(sub => sub.key) || [],
            accessType: 'grant',
          });
        }
      }

      // Add new denied modules
      for (const moduleKey of deniedModules) {
        if (!originalDenied.includes(moduleKey)) {
          const config = moduleConfig[moduleKey];
          await assignModulesToUser.mutateAsync({
            userId: user.id,
            moduleKey,
            submodules: config?.subModules.map(sub => sub.key) || [],
            accessType: 'deny',
          });
        }
      }

      toast({
        title: "User Updated",
        description: `${data.firstName} ${data.lastName} has been updated successfully.`,
      });

      onOpenChange(false);
      onUserUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update user: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = (roleId: string, checked: boolean) => {
    let updatedRoles;
    if (checked) {
      updatedRoles = [...selectedRoles, roleId];
    } else {
      updatedRoles = selectedRoles.filter((id) => id !== roleId);
    }
    setSelectedRoles(updatedRoles);
    form.setValue("roles", updatedRoles);
  };

  const handleModuleGrant = (moduleKey: string, checked: boolean) => {
    let updated = checked 
      ? [...grantedModules, moduleKey]
      : grantedModules.filter(k => k !== moduleKey);
    
    if (checked) {
      setDeniedModules(deniedModules.filter(k => k !== moduleKey));
    }
    
    setGrantedModules(updated);
    form.setValue("grantedModules", updated);
  };

  const handleModuleDeny = (moduleKey: string, checked: boolean) => {
    let updated = checked 
      ? [...deniedModules, moduleKey]
      : deniedModules.filter(k => k !== moduleKey);
    
    if (checked) {
      setGrantedModules(grantedModules.filter(k => k !== moduleKey));
    }
    
    setDeniedModules(updated);
    form.setValue("deniedModules", updated);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter first name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter department" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md z-50">
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div>
                <FormLabel>Roles</FormLabel>
                <div className="mt-2 space-y-2">
                  {roles?.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-role-${role.id}`}
                        checked={selectedRoles.includes(role.id)}
                        onCheckedChange={(checked) =>
                          handleRoleChange(role.id, !!checked)
                        }
                      />
                      <FormLabel
                        htmlFor={`edit-role-${role.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {role.name}
                      </FormLabel>
                    </div>
                  ))}
                </div>
                {selectedRoles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {selectedRoles.map((roleId) => {
                      const role = roles?.find((r) => r.id === roleId);
                      return (
                        <Badge key={roleId} variant="secondary" className="text-xs">
                          {role?.name}
                          <X
                            className="ml-1 h-3 w-3 cursor-pointer"
                            onClick={() => handleRoleChange(roleId, false)}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <FormLabel>Module Access Overrides</FormLabel>
                  <FormDescription>
                    Manage user-specific module access beyond their role permissions.
                  </FormDescription>
                </div>

                {inheritedModules.length > 0 && (
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium">From Selected Roles:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {inheritedModules.map(moduleKey => {
                        const config = moduleConfig[moduleKey];
                        return config ? (
                          <Badge key={moduleKey} variant="outline" className="text-xs">
                            {config.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FormLabel className="text-xs text-muted-foreground">Grant Additional</FormLabel>
                    <div className="mt-2 space-y-2">
                      {Object.entries(moduleConfig).map(([key, config]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-grant-${key}`}
                            checked={grantedModules.includes(key)}
                            onCheckedChange={(checked) => handleModuleGrant(key, !!checked)}
                            disabled={inheritedModules.includes(key)}
                          />
                          <label htmlFor={`edit-grant-${key}`} className="text-xs">
                            {config.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <FormLabel className="text-xs text-muted-foreground">Deny Access</FormLabel>
                    <div className="mt-2 space-y-2">
                      {Object.entries(moduleConfig).map(([key, config]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-deny-${key}`}
                            checked={deniedModules.includes(key)}
                            onCheckedChange={(checked) => handleModuleDeny(key, !!checked)}
                          />
                          <label htmlFor={`edit-deny-${key}`} className="text-xs">
                            {config.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateProfile.isPending || assignRole.isPending || removeRole.isPending}
              >
                {(updateProfile.isPending || assignRole.isPending || removeRole.isPending) ? "Updating..." : "Update User"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};