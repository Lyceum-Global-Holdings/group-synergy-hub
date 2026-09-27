import React, { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
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
import { useAssignCompaniesToUser } from "@/hooks/useUserCompanyAccess";
import { ModuleAccessEditor, ModuleAccessState } from "./ModuleAccessEditor";
import { CompanyAccessSelector } from "./CompanyAccessSelector";

const userSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  // Matches the admin-create-user function, which refuses shorter passwords.
  password: z.string().min(8, "Password must be at least 8 characters"),
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
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [additionalCompanyIds, setAdditionalCompanyIds] = useState<string[]>([]);
  const [hasCustomizedCompanyAccess, setHasCustomizedCompanyAccess] = useState(false);
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
  const assignCompaniesToUser = useAssignCompaniesToUser();

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

  // Check if the selected role is admin or super_admin
  const selectedRoleData = roles?.find(r => r.id === selectedRole);
  const isAdminRole = selectedRoleData?.app_role === 'admin' || selectedRoleData?.app_role === 'super_admin';
  const primaryCompanyId = form.watch("company");

  // Create a stable key for roleModules to prevent infinite loops
  const roleModulesKey = JSON.stringify(roleModules.map(rm => ({ key: rm.module_key, subs: rm.submodules })));

  // Update inherited modules when role changes
  useEffect(() => {
    if (roleModules.length > 0) {
      const inherited: Record<string, string[]> = {};
      roleModules.forEach(rm => {
        inherited[rm.module_key] = rm.submodules || [];
      });
      setModuleAccessState(prev => {
        // Only update if actually different to prevent unnecessary re-renders
        const prevKey = JSON.stringify(prev.inheritedModules);
        const newKey = JSON.stringify(inherited);
        if (prevKey === newKey) return prev;
        return {
          ...prev,
          inheritedModules: inherited,
        };
      });
    } else {
      setModuleAccessState(prev => {
        if (Object.keys(prev.inheritedModules).length === 0) return prev;
        return {
          ...prev,
          inheritedModules: {},
        };
      });
    }
  }, [roleModulesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default admin users to all companies (except primary) so they immediately see relevant module data.
  useEffect(() => {
    if (!isAdminRole) {
      setAdditionalCompanyIds([]);
      setHasCustomizedCompanyAccess(false);
      return;
    }

    if (!primaryCompanyId || !companies?.length) {
      return;
    }

    if (hasCustomizedCompanyAccess) {
      setAdditionalCompanyIds((prev) => prev.filter((id) => id !== primaryCompanyId));
      return;
    }

    const defaultAdditionalCompanyIds = companies
      .map((company) => company.id)
      .filter((companyId): companyId is string => Boolean(companyId) && companyId !== primaryCompanyId);

    setAdditionalCompanyIds(defaultAdditionalCompanyIds);
  }, [isAdminRole, primaryCompanyId, companies, hasCustomizedCompanyAccess]);

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
        // Always persist primary company access; include additional companies for admin roles
        const companyIdsToAssign = Array.from(
          new Set(
            [data.company, ...(isAdminRole ? additionalCompanyIds : [])].filter(
              (companyId): companyId is string => Boolean(companyId)
            )
          )
        );

        if (companyIdsToAssign.length > 0) {
          await assignCompaniesToUser.mutateAsync({
            userId,
            companyIds: companyIdsToAssign,
          });
        }

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
      setAdditionalCompanyIds([]);
      setHasCustomizedCompanyAccess(false);
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
    // Reset additional companies if switching away from admin role
    const newRoleData = roles?.find(r => r.id === roleId);
    if (newRoleData?.app_role !== 'admin' && newRoleData?.app_role !== 'super_admin') {
      setAdditionalCompanyIds([]);
      setHasCustomizedCompanyAccess(false);
    }
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
                      <div className="relative">
                        <Input placeholder="At least 8 characters" autoComplete="new-password" type={showPassword ? "text" : "password"} {...field} />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
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

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Company</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select primary company" />
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
                  <FormDescription>
                    The user's main company affiliation.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Additional Company Access - Only shown for admin roles */}
            {isAdminRole && companies && companies.length > 1 && (
              <div className="space-y-3">
                <div>
                  <FormLabel>Additional Company Access</FormLabel>
                  <FormDescription>
                    Grant this admin user access to additional companies beyond their primary company.
                  </FormDescription>
                </div>
                
                <CompanyAccessSelector
                  companies={companies}
                  primaryCompanyId={primaryCompanyId}
                  selectedCompanyIds={additionalCompanyIds}
                  onSelectionChange={(companyIds) => {
                    setHasCustomizedCompanyAccess(true);
                    setAdditionalCompanyIds(companyIds.filter((companyId) => companyId !== primaryCompanyId));
                  }}
                />
              </div>
            )}

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
