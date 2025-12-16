import React, { useState, useEffect } from "react";
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
import { useRoles, useCreateUser } from "@/hooks/useUsers";
import { useRoleModules, useAssignModulesToUser } from "@/hooks/useModuleAccess";
import { ModuleAccessEditor, ModuleAccessState } from "./ModuleAccessEditor";

const userSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  company: z.string().min(1, "Company is required"),
  role: z.string().min(1, "Please select a role"),
  department: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserAdded?: () => void;
}

export const AddUserDialog: React.FC<AddUserDialogProps> = ({
  open,
  onOpenChange,
  onUserAdded,
}) => {
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [moduleAccessState, setModuleAccessState] = useState<ModuleAccessState>({
    inheritedModules: {},
    grantedSubmodules: {},
    deniedSubmodules: {},
  });
  const { toast } = useToast();
  
  const { companies } = useCompanies();
  const { data: roles } = useRoles();
  const { data: roleModules = [] } = useRoleModules(selectedRole || undefined);
  const createUserMutation = useCreateUser();
  const assignModulesToUser = useAssignModulesToUser();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      company: "",
      role: "",
      department: "",
    },
  });

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

  const onSubmit = async (data: UserFormData) => {
    try {
      const result = await createUserMutation.mutateAsync({
        email: data.email,
        password: data.password,
        fullName: `${data.firstName} ${data.lastName}`,
        department: data.department,
        companyId: data.company,
        roleId: selectedRole,
      });

      const userId = result?.id;
      if (userId) {
        // Save granted submodules
        for (const [moduleKey, submodules] of Object.entries(moduleAccessState.grantedSubmodules)) {
          if (submodules.length > 0) {
            await assignModulesToUser.mutateAsync({
              userId,
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
              userId,
              moduleKey,
              submodules,
              accessType: 'deny',
            });
          }
        }
      }

      toast({
        title: "User Created",
        description: `${data.firstName} ${data.lastName} has been added successfully.`,
      });

      form.reset();
      setSelectedRole("");
      setModuleAccessState({
        inheritedModules: {},
        grantedSubmodules: {},
        deniedSubmodules: {},
      });
      onOpenChange(false);
      onUserAdded?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId);
    form.setValue("role", roleId);
    // Reset user overrides when role changes
    setModuleAccessState(prev => ({
      ...prev,
      grantedSubmodules: {},
      deniedSubmodules: {},
    }));
  };

  const handleGrantChange = (moduleKey: string, submoduleKey: string, granted: boolean) => {
    setModuleAccessState(prev => {
      const newGranted = { ...prev.grantedSubmodules };
      const newDenied = { ...prev.deniedSubmodules };
      
      if (granted) {
        // Add to granted
        if (!newGranted[moduleKey]) newGranted[moduleKey] = [];
        if (!newGranted[moduleKey].includes(submoduleKey)) {
          newGranted[moduleKey] = [...newGranted[moduleKey], submoduleKey];
        }
        // Remove from denied if present
        if (newDenied[moduleKey]) {
          newDenied[moduleKey] = newDenied[moduleKey].filter(k => k !== submoduleKey);
          if (newDenied[moduleKey].length === 0) delete newDenied[moduleKey];
        }
      } else {
        // Remove from granted
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
        // Add to denied
        if (!newDenied[moduleKey]) newDenied[moduleKey] = [];
        if (!newDenied[moduleKey].includes(submoduleKey)) {
          newDenied[moduleKey] = [...newDenied[moduleKey], submoduleKey];
        }
        // Remove from granted if present
        if (newGranted[moduleKey]) {
          newGranted[moduleKey] = newGranted[moduleKey].filter(k => k !== submoduleKey);
          if (newGranted[moduleKey].length === 0) delete newGranted[moduleKey];
        }
      } else {
        // Remove from denied
        if (newDenied[moduleKey]) {
          newDenied[moduleKey] = newDenied[moduleKey].filter(k => k !== submoduleKey);
          if (newDenied[moduleKey].length === 0) delete newDenied[moduleKey];
        }
      }
      
      return { ...prev, grantedSubmodules: newGranted, deniedSubmodules: newDenied };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter email address" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter password" type="password" {...field} />
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
                    <FormControl>
                      <Input placeholder="Enter department" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                <FormLabel>Module Access</FormLabel>
                <FormDescription>
                  User inherits module access from their role. Grant additional or deny specific sub-modules below.
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
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};