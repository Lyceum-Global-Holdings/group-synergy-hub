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
import { useToast } from "@/hooks/use-toast";
import { useCompanies } from "@/hooks/useCompanies";
import { useRoles, useUpdateProfile, useAssignRole, useRemoveRole, type User } from "@/hooks/useUsers";
import { useRoleModules, useUserModules, useAssignModulesToUser, useRemoveUserModule } from "@/hooks/useModuleAccess";
import { ModuleAccessEditor, ModuleAccessState } from "./ModuleAccessEditor";

const editUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  department: z.string().optional(),
  company: z.string().min(1, "Company is required"),
  role: z.string().optional(),
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
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [moduleAccessState, setModuleAccessState] = useState<ModuleAccessState>({
    inheritedModules: {},
    grantedSubmodules: {},
    deniedSubmodules: {},
  });
  const [originalUserModules, setOriginalUserModules] = useState<{ granted: Record<string, string[]>; denied: Record<string, string[]> }>({
    granted: {},
    denied: {},
  });
  const { toast } = useToast();
  
  const { companies } = useCompanies();
  const { data: roles } = useRoles();
  const { data: userModules = [] } = useUserModules(user?.id);
  const { data: roleModules = [] } = useRoleModules(selectedRole || undefined);
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
      role: "",
    },
  });

  // Update form when user changes
  useEffect(() => {
    if (user) {
      const [firstName, lastName] = (user.full_name || "").split(" ", 2);
      const currentRoleId = user.roles.length > 0 ? user.roles[0].id : "";
      form.reset({
        firstName: firstName || "",
        lastName: lastName || "",
        department: user.department || "",
        company: user.company_id || "",
        role: currentRoleId,
      });
      setSelectedRole(currentRoleId);
    }
  }, [user, form]);

  // Load user's module overrides
  useEffect(() => {
    if (userModules.length > 0) {
      const granted: Record<string, string[]> = {};
      const denied: Record<string, string[]> = {};
      
      userModules.forEach(um => {
        if (um.access_type === 'grant') {
          granted[um.module_key] = um.submodules || [];
        } else if (um.access_type === 'deny') {
          denied[um.module_key] = um.submodules || [];
        }
      });
      
      setModuleAccessState(prev => ({
        ...prev,
        grantedSubmodules: granted,
        deniedSubmodules: denied,
      }));
      setOriginalUserModules({ granted, denied });
    } else {
      setModuleAccessState(prev => ({
        ...prev,
        grantedSubmodules: {},
        deniedSubmodules: {},
      }));
      setOriginalUserModules({ granted: {}, denied: {} });
    }
  }, [userModules]);

  // Update inherited modules when role changes
  useEffect(() => {
    if (roleModules.length > 0) {
      const inherited: Record<string, string[]> = {};
      roleModules.forEach(rm => {
        inherited[rm.module_key] = rm.submodules || [];
      });
      setModuleAccessState(prev => ({
        ...prev,
        inheritedModules: inherited,
      }));
    } else {
      setModuleAccessState(prev => ({
        ...prev,
        inheritedModules: {},
      }));
    }
  }, [roleModules]);

  const onSubmit = async (data: EditUserFormData) => {
    if (!user) return;

    try {
      // Update profile
      await updateProfile.mutateAsync({
        userId: user.id,
        updates: {
          full_name: `${data.firstName} ${data.lastName}`,
          department: data.department,
          company_id: data.company,
        },
      });

      // Handle role change
      const currentRoleId = user.roles.length > 0 ? user.roles[0].id : null;
      
      if (selectedRole !== currentRoleId) {
        if (currentRoleId) {
          await removeRole.mutateAsync({ userId: user.id, roleId: currentRoleId });
        }
        if (selectedRole) {
          await assignRole.mutateAsync({ userId: user.id, roleId: selectedRole });
        }
      }

      // Handle module overrides - remove modules no longer in use
      const allOriginalModuleKeys = new Set([
        ...Object.keys(originalUserModules.granted),
        ...Object.keys(originalUserModules.denied),
      ]);
      
      for (const moduleKey of allOriginalModuleKeys) {
        const hasGranted = moduleAccessState.grantedSubmodules[moduleKey]?.length > 0;
        const hasDenied = moduleAccessState.deniedSubmodules[moduleKey]?.length > 0;
        
        if (!hasGranted && !hasDenied) {
          await removeUserModule.mutateAsync({ userId: user.id, moduleKey });
        }
      }

      // Save granted submodules
      for (const [moduleKey, submodules] of Object.entries(moduleAccessState.grantedSubmodules)) {
        if (submodules.length > 0) {
          await assignModulesToUser.mutateAsync({
            userId: user.id,
            moduleKey,
            submodules,
            accessType: 'grant',
          });
        }
      }
      
      // Save denied submodules
      for (const [moduleKey, submodules] of Object.entries(moduleAccessState.deniedSubmodules)) {
        if (submodules.length > 0) {
          await assignModulesToUser.mutateAsync({
            userId: user.id,
            moduleKey,
            submodules,
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

  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId);
    form.setValue("role", roleId);
  };

  const handleGrantChange = (moduleKey: string, submoduleKey: string, granted: boolean) => {
    setModuleAccessState(prev => {
      const newGranted = { ...prev.grantedSubmodules };
      const newDenied = { ...prev.deniedSubmodules };
      
      if (granted) {
        if (!newGranted[moduleKey]) newGranted[moduleKey] = [];
        if (!newGranted[moduleKey].includes(submoduleKey)) {
          newGranted[moduleKey] = [...newGranted[moduleKey], submoduleKey];
        }
        if (newDenied[moduleKey]) {
          newDenied[moduleKey] = newDenied[moduleKey].filter(k => k !== submoduleKey);
          if (newDenied[moduleKey].length === 0) delete newDenied[moduleKey];
        }
      } else {
        if (newGranted[moduleKey]) {
          newGranted[moduleKey] = newGranted[moduleKey].filter(k => k !== submoduleKey);
          if (newGranted[moduleKey].length === 0) delete newGranted[moduleKey];
        }
      }
      
      return { ...prev, grantedSubmodules: newGranted, deniedSubmodules: newDenied };
    });
  };

  const handleDenyChange = (moduleKey: string, submoduleKey: string, denied: boolean) => {
    setModuleAccessState(prev => {
      const newGranted = { ...prev.grantedSubmodules };
      const newDenied = { ...prev.deniedSubmodules };
      
      if (denied) {
        if (!newDenied[moduleKey]) newDenied[moduleKey] = [];
        if (!newDenied[moduleKey].includes(submoduleKey)) {
          newDenied[moduleKey] = [...newDenied[moduleKey], submoduleKey];
        }
        if (newGranted[moduleKey]) {
          newGranted[moduleKey] = newGranted[moduleKey].filter(k => k !== submoduleKey);
          if (newGranted[moduleKey].length === 0) delete newGranted[moduleKey];
        }
      } else {
        if (newDenied[moduleKey]) {
          newDenied[moduleKey] = newDenied[moduleKey].filter(k => k !== submoduleKey);
          if (newDenied[moduleKey].length === 0) delete newDenied[moduleKey];
        }
      }
      
      return { ...prev, grantedSubmodules: newGranted, deniedSubmodules: newDenied };
    });
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

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={handleRoleChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md z-50">
                        {roles?.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Each user can only have one role assigned.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div>
                <FormLabel>Module Access Overrides</FormLabel>
                <FormDescription>
                  Manage user-specific module access beyond their role permissions.
                </FormDescription>
              </div>
              
              <ModuleAccessEditor
                state={moduleAccessState}
                onGrantChange={handleGrantChange}
                onDenyChange={handleDenyChange}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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