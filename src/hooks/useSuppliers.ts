import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Supplier, SupplierContact, CreateSupplierData, UpdateSupplierData } from '@/types/supplier';

// Fetch all suppliers
export const useSuppliers = () => {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await supabase
        .from('suppliers')
        .select(`
          *,
          contacts:supplier_contacts(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching suppliers:', error);
        throw new Error(error.message);
      }

      return (data || []).map(item => ({
        ...item,
        supplier_type: item.supplier_type as any,
        status: item.status as any,
      })) as Supplier[];
    },
  });
};

// Fetch single supplier
export const useSupplier = (id: string) => {
  return useQuery({
    queryKey: ['supplier', id],
    queryFn: async (): Promise<Supplier | null> => {
      const { data, error } = await supabase
        .from('suppliers')
        .select(`
          *,
          contacts:supplier_contacts(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching supplier:', error);
        throw new Error(error.message);
      }

      return data;
    },
    enabled: !!id,
  });
};

// Create supplier
export const useCreateSupplier = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (supplierData: CreateSupplierData): Promise<Supplier> => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Generate supplier code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_supplier_code');

      if (codeError) {
        console.error('Error generating supplier code:', codeError);
        throw new Error('Failed to generate supplier code');
      }

      const { contacts, ...supplierInfo } = supplierData;

      // Create supplier
      const { data: supplier, error: supplierError } = await supabase
        .from('suppliers')
        .insert({
          ...supplierInfo,
          supplier_code: codeData,
          created_by: user.id,
        })
        .select()
        .single();

      if (supplierError) {
        console.error('Error creating supplier:', supplierError);
        throw new Error(supplierError.message);
      }

      // Create contacts if provided
      if (contacts && contacts.length > 0) {
        const contactsToInsert = contacts.map(contact => ({
          ...contact,
          supplier_id: supplier.id,
        }));

        const { error: contactsError } = await supabase
          .from('supplier_contacts')
          .insert(contactsToInsert);

        if (contactsError) {
          console.error('Error creating supplier contacts:', contactsError);
          // Don't throw here as supplier was created successfully
          toast.error('Supplier created but failed to add contacts');
        }
      }

      return supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier created successfully');
    },
    onError: (error: Error) => {
      console.error('Create supplier error:', error);
      toast.error(error.message || 'Failed to create supplier');
    },
  });
};

// Update supplier
export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (supplierData: UpdateSupplierData): Promise<Supplier> => {
      const { id, ...updateData } = supplierData;

      const { data, error } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating supplier:', error);
        throw new Error(error.message);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier', data.id] });
      toast.success('Supplier updated successfully');
    },
    onError: (error: Error) => {
      console.error('Update supplier error:', error);
      toast.error(error.message || 'Failed to update supplier');
    },
  });
};

// Delete supplier
export const useDeleteSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting supplier:', error);
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Delete supplier error:', error);
      toast.error(error.message || 'Failed to delete supplier');
    },
  });
};

// Fetch supplier contacts
export const useSupplierContacts = (supplierId: string) => {
  return useQuery({
    queryKey: ['supplier-contacts', supplierId],
    queryFn: async (): Promise<SupplierContact[]> => {
      const { data, error } = await supabase
        .from('supplier_contacts')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('is_primary', { ascending: false });

      if (error) {
        console.error('Error fetching supplier contacts:', error);
        throw new Error(error.message);
      }

      return data || [];
    },
    enabled: !!supplierId,
  });
};

// Create supplier contact
export const useCreateSupplierContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactData: Omit<SupplierContact, 'id' | 'created_at' | 'updated_at'>): Promise<SupplierContact> => {
      const { data, error } = await supabase
        .from('supplier_contacts')
        .insert(contactData)
        .select()
        .single();

      if (error) {
        console.error('Error creating supplier contact:', error);
        throw new Error(error.message);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-contacts', data.supplier_id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Contact added successfully');
    },
    onError: (error: Error) => {
      console.error('Create contact error:', error);
      toast.error(error.message || 'Failed to add contact');
    },
  });
};

// Update supplier contact
export const useUpdateSupplierContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactData: Partial<SupplierContact> & { id: string }): Promise<SupplierContact> => {
      const { id, ...updateData } = contactData;

      const { data, error } = await supabase
        .from('supplier_contacts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating supplier contact:', error);
        throw new Error(error.message);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-contacts', data.supplier_id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Contact updated successfully');
    },
    onError: (error: Error) => {
      console.error('Update contact error:', error);
      toast.error(error.message || 'Failed to update contact');
    },
  });
};

// Delete supplier contact
export const useDeleteSupplierContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, supplierId }: { id: string; supplierId: string }): Promise<void> => {
      const { error } = await supabase
        .from('supplier_contacts')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting supplier contact:', error);
        throw new Error(error.message);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-contacts', variables.supplierId] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Contact deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Delete contact error:', error);
      toast.error(error.message || 'Failed to delete contact');
    },
  });
};