import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CreateCompanyData, Company } from '@/types/company';

const companyFormSchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  code: z.string().min(2, 'Company code must be at least 2 characters').max(10, 'Company code must be at most 10 characters'),
  address: z.string().optional(),
  logo_url: z.string().optional(),
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
  const [logoPreview, setLogoPreview] = useState<string | null>(company?.logo_url || null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: company?.name || '',
      code: company?.code || '',
      address: company?.address || '',
      logo_url: company?.logo_url || '',
      status: company?.status || 'active',
    },
  });

  const handleLogoUpload = async (file: File) => {
    try {
      setIsUploadingLogo(true);
      
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('File size must be less than 2MB');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      setLogoPreview(publicUrl);
      form.setValue('logo_url', publicUrl);
      
    } catch (error: any) {
      console.error('Logo upload error:', error);
      alert(error.message || 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    form.setValue('logo_url', '');
  };

  const handleSubmit = async (data: CompanyFormData) => {
    try {
      await onSubmit({
        name: data.name,
        code: data.code,
        address: data.address || '',
        logo_url: data.logo_url || '',
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
          name="logo_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Logo</FormLabel>
              <FormControl>
                <div className="space-y-4">
                  {logoPreview ? (
                    <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                      <img
                        src={logoPreview}
                        alt="Company logo preview"
                        className="w-full h-full object-contain"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={handleRemoveLogo}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleLogoUpload(file);
                          }
                        }}
                        disabled={isUploadingLogo}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        {isUploadingLogo ? (
                          <div className="animate-spin">⏳</div>
                        ) : (
                          <Upload className="h-8 w-8 text-muted-foreground" />
                        )}
                        <span className="text-sm text-muted-foreground">
                          {isUploadingLogo ? 'Uploading...' : 'Click to upload logo'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          PNG, JPG up to 2MB
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter company address (multi-line supported)" 
                  rows={3}
                  {...field} 
                />
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
