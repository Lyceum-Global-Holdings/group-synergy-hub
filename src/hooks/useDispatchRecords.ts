import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateDispatchData {
  sales_order_id?: string;
  packing_list_id?: string;
  delivery_address: string;
  delivery_contact?: string;
  delivery_phone?: string;
  courier_name?: string;
  dispatch_date: string;
  estimated_delivery_date?: string;
  delivery_notes?: string;
  company_id?: string;
  dispatch_number?: string;
}

export const useDispatchRecords = (companyId?: string) => {
  return useQuery({
    queryKey: ['dispatch-records', companyId],
    queryFn: async () => {
      let query = supabase
        .from('dispatch_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
};

export const useCreateDispatchRecord = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateDispatchData) => {
      // Generate dispatch number and create dummy packing list ID if not provided
      const dispatchNumber = data.dispatch_number || `DISP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const dummyPackingListId = data.packing_list_id || '00000000-0000-0000-0000-000000000000';
      const dummySalesOrderId = data.sales_order_id || '00000000-0000-0000-0000-000000000000';
      
      const { data: result, error } = await supabase
        .from('dispatch_records')
        .insert([{
          delivery_address: data.delivery_address,
          delivery_contact: data.delivery_contact,
          delivery_phone: data.delivery_phone,
          courier_name: data.courier_name,
          dispatch_date: data.dispatch_date,
          estimated_delivery_date: data.estimated_delivery_date,
          delivery_notes: data.delivery_notes,
          company_id: data.company_id,
          dispatch_number: dispatchNumber,
          packing_list_id: dummyPackingListId,
          sales_order_id: dummySalesOrderId,
        }])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-records'] });
      toast({
        title: "Success",
        description: `Dispatch record ${data.dispatch_number} created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create dispatch record",
        variant: "destructive",
      });
    },
  });
};