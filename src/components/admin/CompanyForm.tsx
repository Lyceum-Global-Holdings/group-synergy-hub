import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateCompanyData, Company } from '@/types/company';

const companyFormSchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  code: z.string().min(2, 'Company code must be at least 2 characters').max(10, 'Company code must be at most 10 characters'),
  address: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

interface CompanyFormProps {
  company?: Company;
  onSubmit: (data: CreateCompanyData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CompanyForm({ company, onSubmit, onCancel, isLoading }: CompanyFormProps) {
  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: company?.name || '',
      code: company?.code || '',
      address: company?.address || '',
      status: company?.status || 'active',
    },
  });

  const handleSubmit = async (data: CompanyFormData) => {
    try {
      await onSubmit({
        name: data.name,
        code: data.code,
        address: data.address || '',
        status: data.status,
      });
      form.reset();
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter company name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., ACME" {...field} />
                </FormControl>
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
                <Input placeholder="Enter company address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : company ? 'Update Company' : 'Create Company'}
          </Button>
        </div>
      </form>
    </Form>
  );
}