import { useEffect, useState } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { Upload, X, Loader2, FileIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { invokeEdgeFunction } from "@/lib/edgeFunctionClient";
import { SupplierField, SupplierFileValue, SupplierFormSchema } from "@/lib/supplierFormSchema";

interface DynamicSupplierFormProps {
  schema: SupplierFormSchema;
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
  footer?: React.ReactNode;
  /** When true, render the form inputs but do not include a submit button (for previews). */
  preview?: boolean;
  /** Public portal slug for uploads (required when form has file fields and is not preview). */
  companySlug?: string;
}

function defaultsFromSchema(schema: SupplierFormSchema): Record<string, any> {
  const out: Record<string, any> = {};
  schema.sections.forEach((s) =>
    s.fields.forEach((f) => {
      if (!f.visible) return;
      if (f.type === "checkbox") out[f.key] = false;
      else if (f.type === "multiselect") out[f.key] = [];
      else if (f.type === "file") out[f.key] = f.multiple ? [] : null;
      else out[f.key] = "";
    }),
  );
  return out;
}

function buildRules(field: SupplierField) {
  const rules: any = {};
  if (field.required) rules.required = `${field.label} is required`;
  if (field.pattern) {
    try {
      rules.pattern = { value: new RegExp(field.pattern), message: field.patternMessage || `Invalid ${field.label}` };
    } catch {
      // ignore bad pattern
    }
  }
  if (field.type === "email") {
    rules.pattern = { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: "Invalid email" };
  }
  return rules;
}

function FieldRenderer({ field, form }: { field: SupplierField; form: UseFormReturn<any> }) {
  return (
    <FormField
      control={form.control}
      name={field.key}
      rules={buildRules(field)}
      render={({ field: rhf }) => (
        <FormItem className={field.type === "textarea" || field.type === "checkbox" ? "md:col-span-2" : ""}>
          {field.type !== "checkbox" && (
            <FormLabel>
              {field.label}
              {field.required && " *"}
            </FormLabel>
          )}
          <FormControl>
            {field.type === "textarea" ? (
              <Textarea placeholder={field.placeholder} {...rhf} value={rhf.value ?? ""} />
            ) : field.type === "select" ? (
              <Select onValueChange={rhf.onChange} value={rhf.value || ""}>
                <SelectTrigger>
                  <SelectValue placeholder={field.placeholder || "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {(field.options || []).map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === "checkbox" ? (
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={!!rhf.value} onCheckedChange={(v) => rhf.onChange(!!v)} />
                <span className="text-sm leading-tight">
                  {field.label}
                  {field.required && " *"}
                </span>
              </label>
            ) : (
              <Input
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "tel" ? "tel" : field.type === "url" ? "url" : field.type === "email" ? "email" : "text"}
                placeholder={field.placeholder}
                {...rhf}
                value={rhf.value ?? ""}
              />
            )}
          </FormControl>
          {field.help && <FormDescription>{field.help}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default function DynamicSupplierForm({
  schema,
  initialValues,
  onSubmit,
  submitting,
  submitLabel = "Submit",
  footer,
  preview,
}: DynamicSupplierFormProps) {
  const form = useForm({ defaultValues: { ...defaultsFromSchema(schema), ...(initialValues || {}) } });

  // Re-sync defaults when schema changes (e.g. preview mode)
  useEffect(() => {
    form.reset({ ...defaultsFromSchema(schema), ...(initialValues || {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  const sections = [...schema.sections].sort((a, b) => a.order - b.order);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          // Strip empty strings to undefined for cleaner downstream handling.
          const clean: Record<string, any> = {};
          Object.entries(values).forEach(([k, v]) => {
            clean[k] = v === "" ? undefined : v;
          });
          await onSubmit(clean);
        })}
        className="space-y-8"
      >
        {sections.map((section) => {
          const fields = section.fields.filter((f) => f.visible);
          if (!fields.length) return null;
          return (
            <div key={section.id} className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{section.title}</h3>
                {section.description && (
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map((f) => (
                  <FieldRenderer key={f.key} field={f} form={form} />
                ))}
              </div>
            </div>
          );
        })}

        {footer}

        {!preview && (
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : submitLabel}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
