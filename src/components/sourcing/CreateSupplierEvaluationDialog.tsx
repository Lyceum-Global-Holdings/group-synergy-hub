import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useCreateSupplierEvaluation, usePopulateEvaluation } from "@/hooks/useSupplierEvaluations";
import { useCompany } from "@/contexts/CompanyContext";
import { useSupplierItems } from "@/hooks/useSupplierItems";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  supplier_id: z.string().min(1, "Please select a supplier"),
  product_name: z.string().min(1, "Product name is required"),
  warehouse_item_id: z.string().optional(),
  evaluation_period_start: z.date({
    required_error: "Start date is required",
  }),
  evaluation_period_end: z.date({
    required_error: "End date is required",
  }),
}).refine((data) => data.evaluation_period_end >= data.evaluation_period_start, {
  message: "End date must be after start date",
  path: ["evaluation_period_end"],
});

type FormData = z.infer<typeof formSchema>;

interface CreateSupplierEvaluationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSupplierEvaluationDialog({
  open,
  onOpenChange,
}: CreateSupplierEvaluationDialogProps) {
  const { selectedCompany } = useCompany();
  const { data: suppliers = [] } = useSuppliers();
  const createEvaluationMutation = useCreateSupplierEvaluation();
  const populate = usePopulateEvaluation();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_id: "",
      product_name: "",
      warehouse_item_id: "",
    },
  });

  const selectedSupplierId = form.watch("supplier_id");
  const { data: supplierItems = [] } = useSupplierItems(selectedSupplierId);

  const onSubmit = async (data: FormData) => {
    try {
      const supplierItem = supplierItems.find(si => si.warehouse_item_id === data.warehouse_item_id);
      
      const created = await createEvaluationMutation.mutateAsync({
        supplier_id: data.supplier_id,
        product_name: data.product_name,
        evaluation_period_start: data.evaluation_period_start.toISOString().split('T')[0],
        evaluation_period_end: data.evaluation_period_end.toISOString().split('T')[0],
        warehouse_item_id: data.warehouse_item_id || undefined,
        supplier_item_id: supplierItem?.id || undefined,
        company_id: selectedCompany?.id,
      });
      // Score the period's approved goods receipts straight away.
      populate.mutate({ evaluationId: created.id });
      
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating supplier evaluation:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Supplier Evaluation</DialogTitle>
          <DialogDescription>
            Choose a supplier and period. Deliveries are scored from the approved goods receipts in that period: lateness against the PO due date, and how much was accepted.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{supplier.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {supplier.supplier_code}
                              </span>
                            </div>
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
                name="warehouse_item_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        const item = supplierItems.find(si => si.warehouse_item_id === value);
                        if (item) {
                          form.setValue('product_name', item.warehouse_item?.name || '');
                        }
                      }} 
                      value={field.value}
                      disabled={!selectedSupplierId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedSupplierId ? "Select item or enter manually" : "Select supplier first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {supplierItems.map((item) => (
                          <SelectItem key={item.id} value={item.warehouse_item_id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{item.warehouse_item?.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {item.warehouse_item?.item_code}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="product_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter product name or select item above" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="evaluation_period_start"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="evaluation_period_end"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                disabled={createEvaluationMutation.isPending}
              >
                {createEvaluationMutation.isPending ? "Creating..." : "Create Evaluation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}