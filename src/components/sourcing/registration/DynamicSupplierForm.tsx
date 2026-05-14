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
  if (field.required) {
    rules.required = `${field.label} is required`;
    if (field.type === "file") {
      rules.validate = (v: any) => {
        if (field.multiple) return (Array.isArray(v) && v.length > 0) || `${field.label} is required`;
        return (v && (v as SupplierFileValue).path) ? true : `${field.label} is required`;
      };
    }
  }
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

function FileUploadField({
  field,
  value,
  onChange,
  companySlug,
  preview,
}: {
  field: SupplierField;
  value: SupplierFileValue | SupplierFileValue[] | null;
  onChange: (v: SupplierFileValue | SupplierFileValue[] | null) => void;
  companySlug?: string;
  preview?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const accept = field.accept || ["application/pdf", "image/jpeg", "image/png"];
  const maxSizeMB = field.maxSizeMB ?? 10;
  const multiple = !!field.multiple;
  const maxFiles = multiple ? Math.max(1, field.maxFiles ?? 1) : 1;
  const items: SupplierFileValue[] = multiple
    ? (Array.isArray(value) ? value : [])
    : (value && !Array.isArray(value) ? [value as SupplierFileValue] : []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (preview) { toast.info("Uploads are disabled in preview mode."); return; }
    if (!companySlug) { toast.error("Company context missing — cannot upload."); return; }

    const remaining = maxFiles - items.length;
    const picked = Array.from(files).slice(0, remaining);
    if (picked.length === 0) { toast.error(`You can upload at most ${maxFiles} file(s).`); return; }

    setUploading(true);
    const uploaded: SupplierFileValue[] = [];
    try {
      for (const file of picked) {
        if (!accept.includes(file.type)) { toast.error(`${file.name}: file type not allowed`); continue; }
        if (file.size > maxSizeMB * 1024 * 1024) { toast.error(`${file.name}: exceeds ${maxSizeMB} MB`); continue; }

        const { data: signed, error } = await invokeEdgeFunction("supplier-upload-sign", {
          body: {
            company_slug: companySlug,
            field_key: field.key,
            filename: file.name,
            mime: file.type,
            size: file.size,
          },
        });
        if (error || !signed?.signed_url || !signed?.path) {
          toast.error(`${file.name}: ${error?.message || "could not get upload URL"}`);
          continue;
        }

        const putRes = await fetch(signed.signed_url, {
          method: "PUT",
          headers: { "Content-Type": file.type, "x-upsert": "false" },
          body: file,
        });
        if (!putRes.ok) {
          toast.error(`${file.name}: upload failed (${putRes.status})`);
          continue;
        }

        uploaded.push({
          path: signed.path,
          name: file.name,
          size: file.size,
          mime: file.type,
          uploaded_at: new Date().toISOString(),
        });
      }

      if (uploaded.length > 0) {
        if (multiple) onChange([...items, ...uploaded]);
        else onChange(uploaded[0]);
        toast.success(`${uploaded.length} file(s) uploaded`);
      }
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(multiple ? next : (next[0] || null));
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-input px-4 py-6 text-sm text-muted-foreground cursor-pointer hover:bg-accent/30 transition-colors">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        <span>
          {uploading
            ? "Uploading..."
            : items.length >= maxFiles
              ? `Maximum ${maxFiles} file(s) reached`
              : `Click to upload ${multiple ? `(up to ${maxFiles})` : ""}`}
        </span>
        <input
          type="file"
          className="hidden"
          accept={accept.join(",")}
          multiple={multiple}
          disabled={uploading || items.length >= maxFiles}
          onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ""; }}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Allowed: {accept.map((m) => m.split("/")[1]?.toUpperCase()).join(", ")} • Max {maxSizeMB} MB
      </p>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={`${it.path}-${i}`} className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{it.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  ({(it.size / 1024).toFixed(0)} KB)
                </span>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAt(i)}>
                <X className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FieldRenderer({ field, form, companySlug, preview }: { field: SupplierField; form: UseFormReturn<any>; companySlug?: string; preview?: boolean }) {
  return (
    <FormField
      control={form.control}
      name={field.key}
      rules={buildRules(field)}
      render={({ field: rhf }) => (
        <FormItem className={field.type === "textarea" || field.type === "checkbox" || field.type === "file" ? "md:col-span-2" : ""}>
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
            ) : field.type === "file" ? (
              <FileUploadField
                field={field}
                value={rhf.value ?? (field.multiple ? [] : null)}
                onChange={rhf.onChange}
                companySlug={companySlug}
                preview={preview}
              />
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
  companySlug,
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
