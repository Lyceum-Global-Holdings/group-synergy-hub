import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
  FormDescription,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useKpiMutations } from "@/hooks/useKpiMutations";
import { useCompany } from "@/contexts/CompanyContext";
import { KpiCategory } from "@/types/kpi";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.enum(["procurement", "warehouse", "finance", "sourcing", "custom"]),
  data_source: z.string().min(1, "Data source is required"),
  calculation_type: z.enum(["sum", "average", "count", "custom_sql"]),
  sql_query: z.string().optional(),
  target_value: z.number().optional(),
  unit: z.string().min(1, "Unit is required"),
  refresh_interval: z.number().min(1, "Refresh interval must be at least 1 minute"),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateCustomKpiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCustomKpiDialog({ open, onOpenChange }: CreateCustomKpiDialogProps) {
  const { selectedCompany } = useCompany();
  const { createKpi } = useKpiMutations();
  const [showSqlField, setShowSqlField] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "custom",
      data_source: "",
      calculation_type: "count",
      sql_query: "",
      unit: "",
      refresh_interval: 60,
    },
  });

  const calculationType = form.watch("calculation_type");

  const handleSubmit = (values: FormValues) => {
    createKpi.mutate(
      {
        ...values,
        company_id: selectedCompany?.id,
        is_system: false,
      },
      {
        onSuccess: () => {
          form.reset();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom KPI</DialogTitle>
          <DialogDescription>
            Define a custom KPI to track specific metrics in your organization
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>KPI Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., On-Time Delivery Rate" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this KPI measures and why it's important"
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="procurement">Procurement</SelectItem>
                        <SelectItem value="warehouse">Warehouse</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="sourcing">Sourcing</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., %, count, days" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="data_source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Source</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., purchase_orders, goods_receipt_notes"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The database table or source where data will be pulled from
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="calculation_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Calculation Type</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setShowSqlField(value === "custom_sql");
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select calculation type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sum">Sum</SelectItem>
                      <SelectItem value="average">Average</SelectItem>
                      <SelectItem value="count">Count</SelectItem>
                      <SelectItem value="custom_sql">Custom SQL</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(calculationType === "custom_sql" || showSqlField) && (
              <FormField
                control={form.control}
                name="sql_query"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SQL Query</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="SELECT COUNT(*) FROM table_name WHERE condition"
                        className="font-mono text-sm"
                        rows={5}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Write a SQL query that returns a single numeric value
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="target_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Value (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 95"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormDescription>Goal or benchmark for this KPI</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="refresh_interval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Refresh Interval (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="60"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormDescription>How often to recalculate</FormDescription>
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
              <Button type="submit" disabled={createKpi.isPending}>
                {createKpi.isPending ? "Creating..." : "Create KPI"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
