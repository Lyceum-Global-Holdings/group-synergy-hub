import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Building2, User, Mail, Phone, Globe, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateSupplier, useUpdateSupplier } from '@/hooks/useSuppliers';
import type { Supplier, SupplierContact, CreateSupplierData, UpdateSupplierData } from '@/types/supplier';
import { SUPPLIER_TYPES, SUPPLIER_STATUSES, SUPPLIER_CATEGORIES, PAYMENT_TERMS, MATERIAL_TYPES, MEASUREMENT_TYPES } from '@/types/supplier';
import { CompanyAllocationSection, type AllocationSettings } from './CompanyAllocationSection';
import { useBulkAllocateSupplier, useUpdateBulkAllocations, useSupplierCompanyAllocations } from '@/hooks/useCompanySuppliers';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { toast } from 'sonner';

const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  legal_name: z.string().optional(),
  supplier_type: z.enum(['vendor', 'service_provider', 'contractor', 'manufacturer']),
  status: z.enum(['active', 'inactive', 'suspended', 'blacklisted']).optional(),
  category: z.string().optional(),
  material_type: z.string().optional(),
  measurement_type: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  tax_id: z.string().optional(),
  registration_number: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  payment_terms: z.string().optional(),
  credit_limit: z.string().optional(),
  currency: z.string().optional(),
  rating: z.string().optional(),
  notes: z.string().optional(),
  contacts: z.array(
    z.object({
      name: z.string().min(1, 'Contact name is required'),
      title: z.string().optional(),
      email: z.string().email('Invalid email address').optional().or(z.literal('')),
      phone: z.string().optional(),
      mobile: z.string().optional(),
      is_primary: z.boolean().default(false),
    })
  ).optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface CreateSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier;
  mode?: 'create' | 'edit';
}

export const CreateSupplierDialog: React.FC<CreateSupplierDialogProps> = ({
  open,
  onOpenChange,
  supplier,
  mode = 'create',
}) => {
  const [activeTab, setActiveTab] = useState('basic');
  const createSupplierMutation = useCreateSupplier();
  const updateSupplierMutation = useUpdateSupplier();
  const bulkAllocate = useBulkAllocateSupplier();
  const updateBulkAllocations = useUpdateBulkAllocations();
  const { data: isSuperAdmin } = useSuperAdmin();
  
  const isEditMode = mode === 'edit' && supplier;

  // Company allocation state
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [allocationSettings, setAllocationSettings] = useState<Map<string, AllocationSettings>>(new Map());

  // Fetch existing allocations in edit mode
  const { data: existingAllocationsData } = useSupplierCompanyAllocations(supplier?.id);

  useEffect(() => {
    if (
      isEditMode &&
      existingAllocationsData &&
      selectedCompanyIds.length === 0 &&
      allocationSettings.size === 0
    ) {
      const selected = existingAllocationsData.map((a) => a.company_id);
      const map = new Map<string, AllocationSettings>();
      existingAllocationsData.forEach((a) => {
        map.set(a.company_id, {
          is_preferred: a.is_preferred,
          payment_terms: a.payment_terms || undefined,
          credit_limit: a.credit_limit ?? undefined,
          notes: a.notes || undefined,
          auto_approve: a.status === 'approved',
          existing_id: a.id,
          existing_status: a.status,
        });
      });
      setSelectedCompanyIds(selected);
      setAllocationSettings(map);
    }
  }, [isEditMode, existingAllocationsData, selectedCompanyIds.length, allocationSettings.size]);

  const allocationsLoaded = !isEditMode || existingAllocationsData !== undefined;
  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: isEditMode ? {
      name: supplier.name,
      legal_name: supplier.legal_name || '',
      supplier_type: supplier.supplier_type,
      status: supplier.status || 'active',
      category: supplier.category || '',
      material_type: supplier.material_type || '',
      measurement_type: supplier.measurement_type || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      website: supplier.website || '',
      tax_id: supplier.tax_id || '',
      registration_number: supplier.registration_number || '',
      address_line1: supplier.address_line1 || '',
      address_line2: supplier.address_line2 || '',
      city: supplier.city || '',
      state: supplier.state || '',
      postal_code: supplier.postal_code || '',
      country: supplier.country || '',
      payment_terms: supplier.payment_terms || '',
      credit_limit: supplier.credit_limit?.toString() || '',
      currency: supplier.currency || 'LKR',
      rating: supplier.rating?.toString() || '',
      notes: supplier.notes || '',
      contacts: supplier.contacts?.map(c => ({
        name: c.name,
        title: c.title || '',
        email: c.email || '',
        phone: c.phone || '',
        mobile: c.mobile || '',
        is_primary: c.is_primary || false,
      })) || [],
    } : {
      name: '',
      legal_name: '',
      supplier_type: 'vendor',
      status: 'active',
      category: '',
      material_type: '',
      measurement_type: '',
      email: '',
      phone: '',
      website: '',
      tax_id: '',
      registration_number: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      payment_terms: '',
      credit_limit: '',
      currency: 'LKR',
      rating: '',
      notes: '',
      contacts: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'contacts',
  });

  const onSubmit = async (data: SupplierFormData) => {
    try {
      // Validate company allocation in create mode
      if (!isEditMode && selectedCompanyIds.length === 0) {
        setActiveTab('allocation');
        return;
      }

        if (isEditMode) {
          // Ensure allocations are loaded and valid before updating
          if (!allocationsLoaded) {
            toast.error('Allocations are still loading. Please wait a moment and try again.');
            setActiveTab('allocation');
            return;
          }
          if (selectedCompanyIds.length === 0) {
            toast.error('Supplier must be allocated to at least one company');
            setActiveTab('allocation');
            return;
          }

          const updateData: UpdateSupplierData = {
            id: supplier.id,
            name: data.name,
            legal_name: data.legal_name,
            supplier_type: data.supplier_type,
            status: data.status,
            category: data.category,
            material_type: data.material_type,
            measurement_type: data.measurement_type,
            email: data.email,
            phone: data.phone,
            website: data.website,
            tax_id: data.tax_id,
            registration_number: data.registration_number,
            address_line1: data.address_line1,
            address_line2: data.address_line2,
            city: data.city,
            state: data.state,
            postal_code: data.postal_code,
            country: data.country,
            payment_terms: data.payment_terms,
            credit_limit: data.credit_limit ? parseFloat(data.credit_limit) : undefined,
            currency: data.currency,
            rating: data.rating ? parseFloat(data.rating) : undefined,
            notes: data.notes,
          };

          const contacts = data.contacts?.filter(contact => contact.name.trim() !== '').map(contact => ({
            name: contact.name,
            title: contact.title || undefined,
            email: contact.email || undefined,
            phone: contact.phone || undefined,
            mobile: contact.mobile || undefined,
            is_primary: contact.is_primary,
          }));

          // 1) Update supplier basic fields first
          await updateSupplierMutation.mutateAsync({ updateData, contacts });

          // 2) Compute precise allocation diffs
          const existingAllocations = existingAllocationsData || [];
          const existingByCompany = new Map(existingAllocations.map((a) => [a.company_id, a]));

          const allocationsToAdd = selectedCompanyIds
            .filter((companyId) => !existingByCompany.has(companyId))
            .map((companyId) => {
              const settings = allocationSettings.get(companyId);
              return {
                company_id: companyId,
                status: (settings?.auto_approve && isSuperAdmin ? 'approved' : 'pending') as 'pending' | 'approved',
                is_preferred: settings?.is_preferred ?? false,
                payment_terms: settings?.payment_terms,
                credit_limit: settings?.credit_limit,
                notes: settings?.notes,
              };
            });

          const allocationsToUpdate = selectedCompanyIds
            .filter((companyId) => !!existingByCompany.get(companyId))
            .map((companyId) => {
              const settings = allocationSettings.get(companyId);
              const existing = existingByCompany.get(companyId)!;
              const diff: any = { id: existing.id, company_id: companyId };
              
              // Check field changes
              if ((settings?.is_preferred ?? false) !== existing.is_preferred) diff.is_preferred = settings?.is_preferred ?? false;
              if ((settings?.payment_terms || null) !== (existing.payment_terms || null)) diff.payment_terms = settings?.payment_terms;
              if ((settings?.credit_limit ?? null) !== (existing.credit_limit ?? null)) diff.credit_limit = settings?.credit_limit;
              if ((settings?.notes || null) !== (existing.notes || null)) diff.notes = settings?.notes;
              
              // Map auto_approve toggle to status changes
              const shouldApprove = !!settings?.auto_approve;
              const wasApproved = existing.status === 'approved';
              if (shouldApprove !== wasApproved) {
                diff.status = shouldApprove ? 'approved' : 'pending';
              }
              
              return diff;
            })
            .filter((update) => Object.keys(update).length > 2); // has changes beyond id/company_id

          const allocationsToRemove = existingAllocations
            .filter((a) => !selectedCompanyIds.includes(a.company_id))
            .map((a) => a.id);

          if (allocationsToAdd.length > 0 || allocationsToUpdate.length > 0 || allocationsToRemove.length > 0) {
            await updateBulkAllocations.mutateAsync({
              supplier_id: supplier.id,
              allocations_to_add: allocationsToAdd.length ? allocationsToAdd : undefined,
              allocations_to_update: allocationsToUpdate.length ? allocationsToUpdate : undefined,
              allocations_to_remove: allocationsToRemove.length ? allocationsToRemove : undefined,
            });
          }

          form.reset();
          setSelectedCompanyIds([]);
          setAllocationSettings(new Map());
          setActiveTab('basic');
          onOpenChange(false);
        } else {
        const submitData: CreateSupplierData = {
          name: data.name,
          legal_name: data.legal_name,
          supplier_type: data.supplier_type,
          category: data.category,
          material_type: data.material_type,
          measurement_type: data.measurement_type,
          email: data.email,
          phone: data.phone,
          website: data.website,
          tax_id: data.tax_id,
          registration_number: data.registration_number,
          address_line1: data.address_line1,
          address_line2: data.address_line2,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
          country: data.country,
          payment_terms: data.payment_terms,
          credit_limit: data.credit_limit ? parseFloat(data.credit_limit) : undefined,
          currency: data.currency,
          rating: data.rating ? parseFloat(data.rating) : undefined,
          notes: data.notes,
          contacts: data.contacts?.filter(contact => contact.name.trim() !== '').map(contact => ({
            name: contact.name,
            title: contact.title || undefined,
            email: contact.email || undefined,
            phone: contact.phone || undefined,
            mobile: contact.mobile || undefined,
            is_primary: contact.is_primary,
          })),
        };

        const newSupplier = await createSupplierMutation.mutateAsync(submitData);

        // Create company allocations - auto-approve when user creates and allocates
        const allocations = selectedCompanyIds.map(companyId => {
          const settings = allocationSettings.get(companyId)!;
          return {
            company_id: companyId,
            status: 'approved' as const,
            is_preferred: settings.is_preferred,
            payment_terms: settings.payment_terms,
            credit_limit: settings.credit_limit,
            notes: settings.notes,
          };
        });

        await bulkAllocate.mutateAsync({
          supplier_id: newSupplier.id,
          allocations,
        });

        form.reset();
        setSelectedCompanyIds([]);
        setAllocationSettings(new Map());
        setActiveTab('basic');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error saving supplier:', error);
    }
  };

  const addContact = () => {
    append({
      name: '',
      title: '',
      email: '',
      phone: '',
      mobile: '',
      is_primary: fields.length === 0, // First contact is primary by default
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {isEditMode ? 'Edit Supplier' : 'Add New Supplier'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Update supplier information and manage contacts.' 
              : 'Create a new supplier profile with contact information and business details.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="business">Business</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="allocation">Allocation</TabsTrigger>
            </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter supplier name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="legal_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Legal Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter legal company name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="supplier_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier Type *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select supplier type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SUPPLIER_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isEditMode && (
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SUPPLIER_STATUSES.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.label}
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
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SUPPLIER_CATEGORIES.map((category) => (
                              <SelectItem key={category.value} value={category.value}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="material_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Material Type</FormLabel>
                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select material type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MATERIAL_TYPES.map((material) => (
                              <SelectItem key={material.value} value={material.value}>
                                {material.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="measurement_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Measurement Type</FormLabel>
                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select measurement type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MEASUREMENT_TYPES.map((measurement) => (
                              <SelectItem key={measurement.value} value={measurement.value}>
                                {measurement.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

                  <FormField
                    control={form.control}
                    name="registration_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter business registration number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Email
                        </FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter email address" {...field} />
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
                        <FormLabel className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Phone
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          Website
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Address Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address_line1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl>
                            <Input placeholder="Street address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address_line2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 2</FormLabel>
                          <FormControl>
                            <Input placeholder="Apartment, suite, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter city" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State/Province</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter state or province" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="postal_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter postal code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter country" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="business" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="payment_terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Payment Terms
                        </FormLabel>
                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment terms" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PAYMENT_TERMS.map((term) => (
                              <SelectItem key={term.value} value={term.value}>
                                {term.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="credit_limit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Limit</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <FormControl>
                          <Input placeholder="LKR" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rating (1-5)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min="1"
                            max="5"
                            placeholder="0.0"
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
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter any additional notes about this supplier..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="contacts" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Contact Persons</h3>
                  <Button type="button" onClick={addContact} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </Button>
                </div>

                {fields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="mx-auto h-12 w-12 mb-4" />
                    <p>No contacts added yet</p>
                    <p className="text-sm">Add contact persons for this supplier</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div key={field.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Contact {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`contacts.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Contact name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`contacts.${index}.title`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Title</FormLabel>
                                <FormControl>
                                  <Input placeholder="Job title" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`contacts.${index}.email`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="Email address" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`contacts.${index}.phone`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone</FormLabel>
                                <FormControl>
                                  <Input placeholder="Phone number" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`contacts.${index}.mobile`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Mobile</FormLabel>
                                <FormControl>
                                  <Input placeholder="Mobile number" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`contacts.${index}.is_primary`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>Primary Contact</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="allocation" className="space-y-4 mt-4">
                <CompanyAllocationSection
                  mode={mode}
                  supplierId={supplier?.id}
                  selectedCompanyIds={selectedCompanyIds}
                  onCompanySelectionChange={setSelectedCompanyIds}
                  allocationSettings={allocationSettings}
                  onAllocationSettingsChange={setAllocationSettings}
                />
              </TabsContent>
            </Tabs>

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
                disabled={((isEditMode && !allocationsLoaded)) || createSupplierMutation.isPending || updateSupplierMutation.isPending || bulkAllocate.isPending || updateBulkAllocations.isPending}
              >
                {isEditMode 
                  ? (updateSupplierMutation.isPending ? 'Updating...' : 'Update Supplier')
                  : (createSupplierMutation.isPending ? 'Creating...' : 'Create Supplier')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};