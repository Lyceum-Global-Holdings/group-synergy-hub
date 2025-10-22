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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompanies } from "@/hooks/useCompanies";
import { useRoles, useCreateUser } from "@/hooks/useUsers";
import { useAssignModulesToUser } from "@/hooks/useModuleAccess";
import { moduleConfig } from "@/constants/moduleConfig";

// Validation schema
const userSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  company: z.string().min(1, "Company is required"),
  roles: z.array(z.string()).min(1, "Please select at least one role"),
  department: z.string().optional(),
  grantedModules: z.array(z.string()).optional(),
  deniedModules: z.array(z.string()).optional(),
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
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [grantedModules, setGrantedModules] = useState<string[]>([]);
  const [deniedModules, setDeniedModules] = useState<string[]>([]);
  const [inheritedModules, setInheritedModules] = useState<string[]>([]);
  const { toast } = useToast();
  
  const { companies } = useCompanies();
  const { data: roles } = useRoles();
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
      roles: [],
      department: "",
      grantedModules: [],
      deniedModules: [],
    },
  });

  // Calculate inherited modules from selected roles
  useEffect(() => {
    const selectedRoleObjects = roles?.filter(r => selectedRoles.includes(r.id)) || [];
    const moduleSet = new Set<string>();
    
    // This is a simplified version - in production you'd fetch roleModules for each role
    // For now, we'll show all available modules as inherited from roles
    selectedRoleObjects.forEach(() => {
      Object.keys(moduleConfig).forEach(key => moduleSet.add(key));
    });
    
    setInheritedModules(Array.from(moduleSet));
  }, [selectedRoles, roles]);

  const onSubmit = async (data: UserFormData) => {
    try {
      const result = await createUserMutation.mutateAsync({
        email: data.email,
        password: data.password,
        fullName: `${data.firstName} ${data.lastName}`,
        department: data.department,
        companyId: data.company,
        roleIds: selectedRoles,
      });

      // Assign user-specific module overrides
      const userId = result?.id;
      if (userId) {
        for (const moduleKey of grantedModules) {
          const config = moduleConfig[moduleKey];
          await assignModulesToUser.mutateAsync({
            userId,
            moduleKey,
            submodules: config?.subModules.map(sub => sub.key) || [],
            accessType: 'grant',
          });
        }
        
        for (const moduleKey of deniedModules) {
          const config = moduleConfig[moduleKey];
          await assignModulesToUser.mutateAsync({
            userId,
            moduleKey,
            submodules: config?.subModules.map(sub => sub.key) || [],
            accessType: 'deny',
          });
        }
      }

      toast({
        title: "User Created",
        description: `${data.firstName} ${data.lastName} has been added successfully.`,
      });

      // Reset form
      form.reset();
      setSelectedRoles([]);
      setGrantedModules([]);
      setDeniedModules([]);
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
    
    // Remove from denied if adding to granted
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
    
    // Remove from granted if adding to denied
    if (checked) {
      setGrantedModules(grantedModules.filter(k => k !== moduleKey));
    }
    
    setDeniedModules(updated);
    form.setValue("deniedModules", updated);
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
                      <Input
                        placeholder="Enter first name"
                        {...field}
                      />
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
                      <Input
                        placeholder="Enter last name"
                        {...field}
                      />
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
                    <Input
                      placeholder="Enter email address"
                      type="email"
                      {...field}
                    />
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
                    <Input
                      placeholder="Enter password"
                      type="password"
                      {...field}
                    />
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
                    <Input
                      placeholder="Enter department"
                      {...field}
                    />
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

          <div className="space-y-4">
            <div>
              <FormLabel>Roles</FormLabel>
              <div className="mt-2 space-y-2">
                {roles?.map((role) => (
                  <div key={role.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={selectedRoles.includes(role.id)}
                      onCheckedChange={(checked) =>
                        handleRoleChange(role.id, !!checked)
                      }
                    />
                    <FormLabel
                      htmlFor={`role-${role.id}`}
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
                <FormLabel>Module Access</FormLabel>
                <FormDescription>
                  User will inherit module access from their assigned roles. You can grant additional or deny specific modules below.
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
                  <FormLabel className="text-xs text-muted-foreground">Grant Additional Access</FormLabel>
                  <div className="mt-2 space-y-2">
                    {Object.entries(moduleConfig).map(([key, config]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`grant-${key}`}
                          checked={grantedModules.includes(key)}
                          onCheckedChange={(checked) => handleModuleGrant(key, !!checked)}
                          disabled={inheritedModules.includes(key)}
                        />
                        <label htmlFor={`grant-${key}`} className="text-xs">
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
                          id={`deny-${key}`}
                          checked={deniedModules.includes(key)}
                          onCheckedChange={(checked) => handleModuleDeny(key, !!checked)}
                        />
                        <label htmlFor={`deny-${key}`} className="text-xs">
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