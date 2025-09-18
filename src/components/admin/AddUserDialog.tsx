import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const companies = [
  { id: "1", name: "Acme Corporation", code: "ACME" },
  { id: "2", name: "Global Industries", code: "GLOB" },
  { id: "3", name: "Tech Solutions Ltd", code: "TECH" },
  { id: "4", name: "Manufacturing Co", code: "MFG" },
];

const availableRoles = [
  "Procurement Manager",
  "Finance Manager", 
  "Warehouse Manager",
  "Sourcing Manager",
  "Operations Lead",
  "Finance Viewer",
  "Inventory Clerk",
  "Purchase Officer"
];

const departments = [
  "Finance",
  "Warehouse", 
  "Operations",
  "Sourcing",
  "Procurement",
  "Management"
];

const userSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  company: z.string().min(1, "Company is required"),
  roles: z.array(z.string()).min(1, "At least one role is required"),
  departments: z.array(z.string()).min(1, "At least one department is required"),
});

type UserFormData = z.infer<typeof userSchema>;

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserAdded: (user: any) => void;
}

export function AddUserDialog({ open, onOpenChange, onUserAdded }: AddUserDialogProps) {
  const { toast } = useToast();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      company: "",
      roles: [],
      departments: [],
    },
  });

  const onSubmit = (data: UserFormData) => {
    const selectedCompany = companies.find(c => c.id === data.company);
    
    const newUser = {
      id: Date.now().toString(),
      name: `${data.firstName} ${data.lastName}`,
      email: data.email,
      company: selectedCompany?.name || "",
      roles: selectedRoles,
      departments: selectedDepartments,
      status: "active",
      lastLogin: "Never",
    };

    onUserAdded(newUser);
    toast({
      title: "User Created",
      description: `${data.firstName} ${data.lastName} has been added successfully.`,
    });
    
    form.reset();
    setSelectedRoles([]);
    setSelectedDepartments([]);
    onOpenChange(false);
  };

  const handleRoleChange = (role: string, checked: boolean) => {
    let updatedRoles;
    if (checked) {
      updatedRoles = [...selectedRoles, role];
    } else {
      updatedRoles = selectedRoles.filter(r => r !== role);
    }
    setSelectedRoles(updatedRoles);
    form.setValue("roles", updatedRoles);
  };

  const handleDepartmentChange = (department: string, checked: boolean) => {
    let updatedDepartments;
    if (checked) {
      updatedDepartments = [...selectedDepartments, department];
    } else {
      updatedDepartments = selectedDepartments.filter(d => d !== department);
    }
    setSelectedDepartments(updatedDepartments);
    form.setValue("departments", updatedDepartments);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account with company, role, and department assignments.
          </DialogDescription>
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
                      <Input placeholder="John" {...field} />
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
                      <Input placeholder="Doe" {...field} />
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
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="john.doe@company.com" type="email" {...field} />
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a company" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name} ({company.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel>Roles</FormLabel>
              <div className="grid grid-cols-2 gap-3">
                {availableRoles.map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role}`}
                      checked={selectedRoles.includes(role)}
                      onCheckedChange={(checked) => 
                        handleRoleChange(role, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={`role-${role}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {role}
                    </label>
                  </div>
                ))}
              </div>
              {selectedRoles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedRoles.map((role) => (
                    <Badge key={role} variant="outline" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              )}
              {form.formState.errors.roles && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.roles.message}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <FormLabel>Departments</FormLabel>
              <div className="grid grid-cols-2 gap-3">
                {departments.map((department) => (
                  <div key={department} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dept-${department}`}
                      checked={selectedDepartments.includes(department)}
                      onCheckedChange={(checked) => 
                        handleDepartmentChange(department, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={`dept-${department}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {department}
                    </label>
                  </div>
                ))}
              </div>
              {selectedDepartments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedDepartments.map((dept) => (
                    <Badge key={dept} variant="secondary" className="text-xs">
                      {dept}
                    </Badge>
                  ))}
                </div>
              )}
              {form.formState.errors.departments && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.departments.message}
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Create User</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}