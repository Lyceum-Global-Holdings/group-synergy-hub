import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateDispatchRecord } from '@/hooks/useDispatchRecords';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';
import { DemandAnalysisResult } from '@/types/materialDemand';

const formSchema = z.object({
  delivery_address: z.string().min(1, 'Delivery address is required'),
  delivery_contact: z.string().optional(),
  delivery_phone: z.string().optional(),
  courier_name: z.string().optional(),
  dispatch_date: z.string().min(1, 'Dispatch date is required'),
  estimated_delivery_date: z.string().optional(),
  delivery_notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateDispatchNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DemandAnalysisResult;
}

export const CreateDispatchNoteDialog: React.FC<CreateDispatchNoteDialogProps> = ({
  open,
  onOpenChange,
  item,
}) => {
  const { selectedCompany } = useCompany();
  const createDispatchMutation = useCreateDispatchRecord();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      delivery_address: '',
      delivery_contact: '',
      delivery_phone: '',
      courier_name: '',
      dispatch_date: format(new Date(), 'yyyy-MM-dd'),
      estimated_delivery_date: '',
      delivery_notes: `Dispatch for ${item.item_name} - Quantity: ${item.total_required}`,
    },
  });

  const onSubmit = (data: FormData) => {
    createDispatchMutation.mutate({
      delivery_address: data.delivery_address,
      delivery_contact: data.delivery_contact,
      delivery_phone: data.delivery_phone,
      courier_name: data.courier_name,
      dispatch_date: data.dispatch_date,
      estimated_delivery_date: data.estimated_delivery_date,
      delivery_notes: data.delivery_notes,
      company_id: selectedCompany?.id,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Dispatch Note</DialogTitle>
          <DialogDescription>
            Create a dispatch note for {item.item_name} - {item.total_required} {item.unit_of_measure}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="delivery_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Address *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter complete delivery address"
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
                name="delivery_contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="delivery_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="courier_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Courier Service</FormLabel>
                    <FormControl>
                      <Input placeholder="Courier name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dispatch_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dispatch Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="estimated_delivery_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Delivery Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="delivery_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Special delivery instructions"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createDispatchMutation.isPending}
              >
                {createDispatchMutation.isPending ? 'Creating...' : 'Create Dispatch Note'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};