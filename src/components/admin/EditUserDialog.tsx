import React, { useEffect, useState } from "react";
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
import { useRoles, useUpdateProfile, useAssignRole, useRemoveRole, type User } from "@/hooks/useUsers";
import { useRoleModules, useUserModules, useAssignModulesToUser, useRemoveUserModule } from "@/hooks/useModuleAccess";
import { useUserCompanyAccess, useAssignCompaniesToUser } from "@/hooks/useUserCompanyAccess";
import { ModuleAccessEditor, ModuleAccessState } from "./ModuleAccessEditor";
import { CompanyAccessSelector } from "./CompanyAccessSelector";
import { UserLocationPermissions } from "./UserLocationPermissions";
import { useUserLocationPermissions, useUserViewAllLocations, useSaveUserLocationPermissions, useLocationsForCompanies } from "@/hooks/useUserLocationPermissions";
import type { ModuleOperation } from "@/types/moduleAccess";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useAdminPasswordReset } from "@/hooks/useAdminPasswordReset";

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
  const [additionalCompanyIds, setAdditionalCompanyIds] = useState<string[]>([]);
  const [viewLocationIds, setViewLocationIds] = useState<string[]>([]);
  const [editLocationIds, setEditLocationIds] = useState<string[]>([]);
  const [viewAllLocations, setViewAllLocations] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [moduleAccessState, setModuleAccessState] = useState<ModuleAccessState>({
    inheritedModules: {},
    inheritedOperations: {},
    grantedSubmodules: {},
    grantedOperations: {},
    deniedSubmodules: {},
  });
  const [originalUserModules, setOriginalUserModules] = useState<{ 
    granted: Record<string, string[]>; 
    denied: Record<string, string[]>;
    operations: Record<string, ModuleOperation[]>;
  }>({
    granted: {},
    denied: {},
    operations: {},
  });
  const { toast } = useToast();
  
  const { companies } = useCompanies();
  const { data: roles } = useRoles();
  const { data: userModules = [] } = useUserModules(user?.id);
  const { data: userCompanyAccess = [] } = useUserCompanyAccess(user?.id);
  const { data: roleModules = [] } = useRoleModules(selectedRole || undefined);
  const updateProfile = useUpdateProfile();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();
  const assignModulesToUser = useAssignModulesToUser();
  const removeUserModule = useRemoveUserModule();
  const assignCompaniesToUser = useAssignCompaniesToUser();
  const { data: locationPermissions = [], isLoading: locationPermissionsLoading } = useUserLocationPermissions(user?.id);
  const { data: userViewAll = false, isLoading: viewAllLoading } = useUserViewAllLocations(user?.id);
  const saveLocationPermissions = useSaveUserLocationPermissions();
  const { data: isSuperAdmin = false } = useSuperAdmin();
  const resetPassword = useAdminPasswordReset();

  // Effective company IDs for location filtering - must be before early return
  const [currentPrimaryCompany, setCurrentPrimaryCompany] = useState(user?.company_id || '');
  const effectiveCompanyIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (currentPrimaryCompany) ids.add(currentPrimaryCompany);
    additionalCompanyIds.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [currentPrimaryCompany, additionalCompanyIds]);
  const { data: availableLocations = [], isLoading: locationsLoading } = useLocationsForCompanies(effectiveCompanyIds);

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
      setCurrentPrimaryCompany(user.company_id || '');
    }
  }, [user, form]);

  // Reset local location state when switching users to avoid stale carry-over
  useEffect(() => {
    setViewLocationIds([]);
    setEditLocationIds([]);
    setViewAllLocations(false);
  }, [user?.id]);

  // Load user's location permissions
  useEffect(() => {
    const editIds = Array.from(
      new Set(locationPermissions.filter((p) => p.permission_type === 'edit').map((p) => p.location_id))
    );
    const viewIds = Array.from(
      new Set([
        ...locationPermissions.filter((p) => p.permission_type === 'view').map((p) => p.location_id),
        ...editIds,
      ])
    );

    setViewLocationIds(viewIds);
    setEditLocationIds(editIds);
  }, [locationPermissions]);

  // Load view all locations flag
  useEffect(() => {
    setViewAllLocations(userViewAll);
  }, [userViewAll]);

  // Load user's existing company access (exclude primary company from additional list)
  useEffect(() => {
    const companyIds = userCompanyAccess
      .map((uca) => uca.company_id)
      .filter((id): id is string => !!id && id !== currentPrimaryCompany);

    setAdditionalCompanyIds(companyIds);
  }, [userCompanyAccess, currentPrimaryCompany]);

  // Load user's module overrides
  useEffect(() => {
    if (userModules.length > 0) {
      const granted: Record<string, string[]> = {};
      const denied: Record<string, string[]> = {};
      const operations: Record<string, ModuleOperation[]> = {};
      
      userModules.forEach(um => {
        if (um.access_type === 'grant') {
          granted[um.module_key] = um.submodules || [];
          operations[um.module_key] = (um.operations || ['view']) as ModuleOperation[];
        } else if (um.access_type === 'deny') {
          denied[um.module_key] = um.submodules || [];
        }
      });
      
      setModuleAccessState(prev => ({
        ...prev,
        grantedSubmodules: granted,
        grantedOperations: operations,
        deniedSubmodules: denied,
      }));
      setOriginalUserModules({ granted, denied, operations });
    } else {
      setModuleAccessState(prev => ({
        ...prev,
        grantedSubmodules: {},
        grantedOperations: {},
        deniedSubmodules: {},
      }));
      setOriginalUserModules({ granted: {}, denied: {}, operations: {} });
    }
  }, [userModules]);

  // Update inherited modules when role changes
  useEffect(() => {
    if (roleModules.length > 0) {
      const inherited: Record<string, string[]> = {};
      const inheritedOps: Record<string, ModuleOperation[]> = {};
      roleModules.forEach(rm => {
        inherited[rm.module_key] = rm.submodules || [];
        inheritedOps[rm.module_key] = (rm.operations || ['view']) as ModuleOperation[];
      });
      setModuleAccessState(prev => ({
        ...prev,
        inheritedModules: inherited,
        inheritedOperations: inheritedOps,
      }));
    } else {
      setModuleAccessState(prev => ({
        ...prev,
        inheritedModules: {},
        inheritedOperations: {},
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

      // Handle company access (applies to all roles)
      const scopedAdditionalCompanyIds = additionalCompanyIds.filter(
        (companyId) => companyId && companyId !== data.company
      );

      await assignCompaniesToUser.mutateAsync({
        userId: user.id,
        companyIds: scopedAdditionalCompanyIds,
      });

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
          const operations = moduleAccessState.grantedOperations?.[moduleKey] || ['view'];
          await assignModulesToUser.mutateAsync({
            userId: user.id,
            moduleKey,
            submodules,
            accessType: 'grant',
            operations,
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

      // Save location permissions (strictly scoped to currently assigned companies)
      const allowedLocationIds = new Set(availableLocations.map((location) => location.id));
      const scopedViewLocationIds = viewLocationIds.filter((id) => allowedLocationIds.has(id));
      const scopedEditLocationIds = editLocationIds.filter((id) => allowedLocationIds.has(id));

      await saveLocationPermissions.mutateAsync({
        userId: user.id,
        viewLocationIds: scopedViewLocationIds,
        editLocationIds: scopedEditLocationIds,
        viewAllLocations,
      });

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

  const handleOperationsChange = (moduleKey: string, operations: ModuleOperation[]) => {
    setModuleAccessState(prev => ({
      ...prev,
      grantedOperations: {
        ...prev.grantedOperations,
        [moduleKey]: operations,
      },
    }));
  };

  if (!user) return null;

  const primaryCompanyId = form.watch("company");

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
                    <Select value={field.value} onValueChange={(v) => { field.onChange(v); setCurrentPrimaryCompany(v); }}>
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

            {/* Additional Company Access */}
            {companies && companies.length > 1 && (
              <div className="space-y-3">
                <div>
                  <FormLabel>Additional Company Access</FormLabel>
                  <FormDescription>
                    Grant this user access to additional companies beyond their primary company.
                  </FormDescription>
                </div>
                
                <CompanyAccessSelector
                  companies={companies}
                  primaryCompanyId={primaryCompanyId}
                  selectedCompanyIds={additionalCompanyIds}
                  onSelectionChange={setAdditionalCompanyIds}
                />
              </div>
            )}

            {/* Location Permissions */}
            <div className="space-y-3">
              <div>
                <FormLabel>Location Permissions</FormLabel>
                <FormDescription>
                  Control which locations this user can view and edit data for.
                </FormDescription>
              </div>
              
              <UserLocationPermissions
                availableLocations={availableLocations}
                viewLocationIds={viewLocationIds}
                editLocationIds={editLocationIds}
                viewAllLocations={viewAllLocations}
                onViewLocationsChange={setViewLocationIds}
                onEditLocationsChange={setEditLocationIds}
                onViewAllLocationsChange={setViewAllLocations}
                isLoading={locationsLoading || locationPermissionsLoading || viewAllLoading}
              />
            </div>

            {/* Reset Password - Super Admin Only */}
            {isSuperAdmin && (
              <div className="space-y-3">
                <div>
                  <FormLabel>Reset Password</FormLabel>
                  <FormDescription>
                    Set a new password for this user. Only visible to super admins.
                  </FormDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!newPassword || newPassword.length < 6 || resetPassword.isPending}
                    onClick={async () => {
                      if (user && newPassword) {
                        await resetPassword.mutateAsync({ userId: user.id, newPassword });
                        setNewPassword("");
                        setShowPassword(false);
                      }
                    }}
                  >
                    {resetPassword.isPending ? "Resetting..." : "Reset"}
                  </Button>
                </div>
              </div>
            )}

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
                onOperationsChange={handleOperationsChange}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateProfile.isPending || assignRole.isPending || removeRole.isPending || assignCompaniesToUser.isPending || assignModulesToUser.isPending || removeUserModule.isPending || saveLocationPermissions.isPending}
              >
                {(updateProfile.isPending || assignRole.isPending || removeRole.isPending || assignCompaniesToUser.isPending || assignModulesToUser.isPending || removeUserModule.isPending || saveLocationPermissions.isPending) ? "Updating..." : "Update User"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
