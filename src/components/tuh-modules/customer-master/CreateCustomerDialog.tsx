import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Building2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomers } from "@/hooks/useCustomers";
import { useCompany } from "@/contexts/CompanyContext";
import { CreateCustomerData } from "@/types/customer";
import { DocumentUploadField } from "./DocumentUploadField";

const createCustomerSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
  customer_type: z.enum(['person', 'company']).default('person'),
  contact_person: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  company_id: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  // Company-specific fields
  company_registration_document_url: z.string().optional(),
  registration_number: z.string().optional(),
  tax_id: z.string().optional(),
  // Person-specific fields
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  id_passport_number: z.string().optional(),
}).refine((data) => {
  // If customer_type is company, require registration_number
  if (data.customer_type === 'company') {
    return data.registration_number && data.registration_number.length > 0;
  }
  return true;
}, {
  message: "Registration number is required for companies",
  path: ["registration_number"],
}).refine((data) => {
  // If customer_type is person, require first_name and last_name
  if (data.customer_type === 'person') {
    return data.first_name && data.first_name.length > 0 && 
           data.last_name && data.last_name.length > 0;
  }
  return true;
}, {
  message: "First name and last name are required for individuals",
  path: ["first_name"],
});

type CreateCustomerFormData = z.infer<typeof createCustomerSchema>;

interface CreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateCustomerDialog({
  open,
  onOpenChange,
}: CreateCustomerDialogProps) {
  const { selectedCompany, isViewingAllCompanies, companies } = useCompany();
  const { createCustomer } = useCustomers();
  const [documentUrl, setDocumentUrl] = useState<string>("");

  const form = useForm<CreateCustomerFormData>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      customer_name: "",
      customer_type: "person",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      company_id: selectedCompany?.id || "",
      status: "active",
      company_registration_document_url: "",
      registration_number: "",
      tax_id: "",
      first_name: "",
      last_name: "",
      id_passport_number: "",
    },
  });

  const watchedCustomerType = form.watch("customer_type");

  const onSubmit = async (data: CreateCustomerFormData) => {
    try {
      const cleanedData: CreateCustomerData = {
        customer_name: data.customer_name,
        customer_type: data.customer_type,
        contact_person: data.contact_person || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        company_id: data.company_id || undefined,
        status: data.status,
        // Include document URL if uploaded
        company_registration_document_url: documentUrl || undefined,
        registration_number: data.registration_number || undefined,
        tax_id: data.tax_id || undefined,
        first_name: data.first_name || undefined,
        last_name: data.last_name || undefined,
        id_passport_number: data.id_passport_number || undefined,
      };
      
      await createCustomer.mutateAsync(cleanedData);
      form.reset();
      setDocumentUrl("");
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create customer:', error);
    }
  };

  const handleCustomerTypeChange = (value: string) => {
    form.setValue("customer_type", value as "person" | "company");
    // Clear type-specific fields when switching
    if (value === "person") {
      form.setValue("registration_number", "");
      form.setValue("tax_id", "");
      form.setValue("company_registration_document_url", "");
      setDocumentUrl("");
    } else {
      form.setValue("first_name", "");
      form.setValue("last_name", "");
      form.setValue("id_passport_number", "");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Customer</DialogTitle>
          <DialogDescription>
            Add a new customer to the system. Choose between individual person or company.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Customer Type Selection */}
            <FormField
              control={form.control}
              name="customer_type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-semibold">Customer Type *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={handleCustomerTypeChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="person" id="person" />
                        <Users className="w-5 h-5 text-muted-foreground" />
                        <Label htmlFor="person" className="flex-1 cursor-pointer">
                          <div className="font-medium">Individual Person</div>
                          <div className="text-sm text-muted-foreground">
                            Individual customer with personal details
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="company" id="company" />
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                        <Label htmlFor="company" className="flex-1 cursor-pointer">
                          <div className="font-medium">Company</div>
                          <div className="text-sm text-muted-foreground">
                            Business entity with registration details
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Common Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchedCustomerType === 'company' ? 'Company Name' : 'Full Name'} *
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={watchedCustomerType === 'company' ? 'Enter company name' : 'Enter full name'} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchedCustomerType === 'company' ? 'Contact Person' : 'Alternative Contact'}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={watchedCustomerType === 'company' ? 'Primary contact person' : 'Alternative contact name'} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="Enter email address" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Person-specific fields */}
            {watchedCustomerType === 'person' && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Individual Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter first name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="id_passport_number"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>ID/Passport Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter ID or passport number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Company-specific fields */}
            {watchedCustomerType === 'company' && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Business Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="registration_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Registration Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter BR number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tax_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter tax identification number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Business Registration Document</Label>
                  <DocumentUploadField
                    customerId="" // Will be set after creation
                    currentDocumentUrl={documentUrl}
                    onUpload={(url) => {
                      setDocumentUrl(url);
                      form.setValue("company_registration_document_url", url);
                    }}
                    label="Upload BR document (PDF, JPG, PNG - Max 10MB)"
                  />
                </div>
              </div>
            )}

            {/* Additional Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isViewingAllCompanies && (
                <FormField
                  control={form.control}
                  name="company_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select company" />
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
              )}

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter customer address" 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCustomer.isPending}
              >
                {createCustomer.isPending ? "Creating..." : "Create Customer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}