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
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompanies } from "@/hooks/useCompanies";
import { useRoles, useUpdateProfile, useAssignRole, useRemoveRole, type User } from "@/hooks/useUsers";

const editUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  department: z.string().optional(),
  company: z.string().min(1, "Company is required"),
  roles: z.array(z.string()),
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
  const { toast } = useToast();
  
  const { companies } = useCompanies();
  const { data: roles } = useRoles();
  const updateProfile = useUpdateProfile();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();

  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      department: "",
      company: "",
      roles: [],
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
      });
      setSelectedRoles(user.roles.map(r => r.id));
    }
  }, [user, form]);

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

      // Add new roles
      for (const roleId of rolesToAdd) {
        await assignRole.mutateAsync({ userId: user.id, roleId });
      }

      // Remove old roles
      for (const roleId of rolesToRemove) {
        await removeRole.mutateAsync({ userId: user.id, roleId });
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