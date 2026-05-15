import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { Upload, X, Loader2, FileIcon, RotateCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

type UploadStatus = "queued" | "signing" | "uploading" | "success" | "error" | "canceled";

interface UploadTask {
  id: string;
  file: File;
  progress: number; // 0-100
  status: UploadStatus;
  error?: string;
  attempt: number;
  permanent?: boolean; // true => no retry button
  xhr?: XMLHttpRequest;
  aborted?: boolean;
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1500, 4000];

function isTransientStatus(status: number) {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
  bindXhr: (xhr: XMLHttpRequest) => void,
): Promise<{ ok: boolean; status: number; aborted?: boolean }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.timeout = 5 * 60 * 1000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.onabort = () => resolve({ ok: false, status: 0, aborted: true });
    bindXhr(xhr);
    xhr.send(file);
  });
}

function FileUploadField({
  field,
  value,
  onChange,
  companySlug,
  preview,
  onActiveChange,
}: {
  field: SupplierField;
  value: SupplierFileValue | SupplierFileValue[] | null;
  onChange: (v: SupplierFileValue | SupplierFileValue[] | null) => void;
  companySlug?: string;
  preview?: boolean;
  onActiveChange?: (fieldKey: string, active: boolean) => void;
}) {
  const accept = field.accept || ["application/pdf", "image/jpeg", "image/png"];
  const maxSizeMB = field.maxSizeMB ?? 10;
  const multiple = !!field.multiple;
  const maxFiles = multiple ? Math.max(1, field.maxFiles ?? 1) : 1;
  const items: SupplierFileValue[] = multiple
    ? (Array.isArray(value) ? value : [])
    : (value && !Array.isArray(value) ? [value as SupplierFileValue] : []);

  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const tasksRef = useRef<UploadTask[]>([]);
  tasksRef.current = tasks;
  const valueRef = useRef(value);
  valueRef.current = value;

  const updateTask = useCallback((id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  // Notify parent about in-flight uploads
  const activeCount = tasks.filter((t) => ["queued", "signing", "uploading"].includes(t.status)).length;
  useEffect(() => {
    onActiveChange?.(field.key, activeCount > 0);
    return () => onActiveChange?.(field.key, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      tasksRef.current.forEach((t) => {
        if (t.xhr && ["uploading", "signing"].includes(t.status)) {
          try { t.xhr.abort(); } catch { /* noop */ }
        }
      });
    };
  }, []);

  const commitSuccess = useCallback((uploaded: SupplierFileValue) => {
    const current = valueRef.current;
    if (multiple) {
      const arr = Array.isArray(current) ? current : [];
      onChange([...arr, uploaded]);
    } else {
      onChange(uploaded);
    }
  }, [multiple, onChange]);

  const runUpload = useCallback(async (taskId: string) => {
    const task = tasksRef.current.find((t) => t.id === taskId);
    if (!task) return;

    let attempt = task.attempt;

    while (attempt <= MAX_ATTEMPTS) {
      // Check if canceled between attempts
      const fresh = tasksRef.current.find((t) => t.id === taskId);
      if (!fresh || fresh.status === "canceled") return;

      updateTask(taskId, { status: "signing", attempt, progress: 0, error: undefined });

      // 1) sign
      let signed: any = null;
      let signErr: any = null;
      try {
        const res = await invokeEdgeFunction("supplier-upload-sign", {
          body: {
            company_slug: companySlug,
            field_key: field.key,
            filename: task.file.name,
            mime: task.file.type,
            size: task.file.size,
          },
        });
        signed = res.data;
        signErr = res.error;
      } catch (e: any) {
        signErr = { message: e?.message || "Network error" };
      }

      if (signErr || !signed?.signed_url || !signed?.path) {
        const msg = signErr?.message || "could not get upload URL";
        const transient = /network|timeout|fetch|temporar/i.test(msg);
        if (transient && attempt < MAX_ATTEMPTS) {
          updateTask(taskId, { status: "error", error: `${msg} — retrying…`, attempt });
          await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1] + Math.random() * 250));
          attempt += 1;
          continue;
        }
        updateTask(taskId, { status: "error", error: msg, attempt, permanent: !transient });
        return;
      }

      // 2) PUT with progress
      updateTask(taskId, { status: "uploading", progress: 0, error: undefined });
      try {
        const result = await putWithProgress(
          signed.signed_url,
          task.file,
          (pct) => updateTask(taskId, { progress: pct }),
          (xhr) => updateTask(taskId, { xhr }),
        );
        if (result.aborted) {
          // Was canceled by user
          updateTask(taskId, { status: "canceled", xhr: undefined });
          return;
        }
        if (result.ok) {
          updateTask(taskId, { status: "success", progress: 100, xhr: undefined });
          commitSuccess({
            path: signed.path,
            name: task.file.name,
            size: task.file.size,
            mime: task.file.type,
            uploaded_at: new Date().toISOString(),
          });
          // Auto-prune success rows after a moment
          setTimeout(() => {
            setTasks((prev) => prev.filter((t) => t.id !== taskId));
          }, 1500);
          return;
        }
        // Non-2xx
        if (isTransientStatus(result.status) && attempt < MAX_ATTEMPTS) {
          updateTask(taskId, {
            status: "error",
            error: `Upload failed (${result.status}) — retrying…`,
            attempt,
            xhr: undefined,
          });
          await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1] + Math.random() * 250));
          attempt += 1;
          continue;
        }
        updateTask(taskId, {
          status: "error",
          error: `Upload failed (${result.status})`,
          attempt,
          permanent: !isTransientStatus(result.status),
          xhr: undefined,
        });
        return;
      } catch (e: any) {
        const msg = e?.message || "Upload failed";
        if (attempt < MAX_ATTEMPTS) {
          updateTask(taskId, { status: "error", error: `${msg} — retrying…`, attempt, xhr: undefined });
          await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1] + Math.random() * 250));
          attempt += 1;
          continue;
        }
        updateTask(taskId, { status: "error", error: msg, attempt, xhr: undefined });
        return;
      }
    }
  }, [companySlug, field.key, commitSuccess, updateTask]);

  const enqueue = useCallback((file: File) => {
    const id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`);
    const task: UploadTask = { id, file, progress: 0, status: "queued", attempt: 1 };
    setTasks((prev) => [...prev, task]);
    // Kick off after state commit
    setTimeout(() => runUpload(id), 0);
  }, [runUpload]);

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files || (Array.isArray(files) ? files.length : files.length) === 0) return;
    if (preview) { toast.info("Uploads are disabled in preview mode."); return; }
    if (!companySlug) { toast.error("Company context missing — cannot upload."); return; }

    const inFlight = tasksRef.current.filter((t) => t.status !== "canceled" && t.status !== "error").length;
    const remaining = maxFiles - items.length - inFlight;
    if (remaining <= 0) { toast.error(`You can upload at most ${maxFiles} file(s).`); return; }

    const arr = Array.from(files as any as File[]).slice(0, remaining);
    for (const file of arr) {
      if (!accept.includes(file.type)) { toast.error(`${file.name}: file type not allowed`); continue; }
      if (file.size > maxSizeMB * 1024 * 1024) { toast.error(`${file.name}: exceeds ${maxSizeMB} MB`); continue; }
      enqueue(file);
    }
  };

  const cancelTask = (id: string) => {
    const t = tasksRef.current.find((x) => x.id === id);
    if (!t) return;
    if (t.xhr) { try { t.xhr.abort(); } catch { /* noop */ } }
    updateTask(id, { status: "canceled", xhr: undefined });
  };

  const retryTask = (id: string) => {
    updateTask(id, { status: "queued", attempt: 1, progress: 0, error: undefined, permanent: false });
    setTimeout(() => runUpload(id), 0);
  };

  const dismissTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const removeAt = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(multiple ? next : (next[0] || null));
  };

  const slotsTaken = items.length + tasks.filter((t) => t.status !== "canceled" && t.status !== "error").length;
  const dropDisabled = slotsTaken >= maxFiles;

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (dropDisabled) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <label
        className={`flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-input px-4 py-6 text-sm text-muted-foreground transition-colors ${dropDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-accent/30"}`}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={onDrop}
      >
        <Upload className="w-4 h-4" />
        <span>
          {dropDisabled
            ? `Maximum ${maxFiles} file(s) reached`
            : `Click or drop file${multiple ? "s" : ""}${multiple ? ` (up to ${maxFiles})` : ""}`}
        </span>
        <input
          type="file"
          className="hidden"
          accept={accept.join(",")}
          multiple={multiple}
          disabled={dropDisabled}
          onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ""; }}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Allowed: {accept.map((m) => m.split("/")[1]?.toUpperCase()).join(", ")} • Max {maxSizeMB} MB
      </p>

      {tasks.length > 0 && (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const inFlight = t.status === "signing" || t.status === "uploading" || t.status === "queued";
            const isError = t.status === "error";
            const isCanceled = t.status === "canceled";
            const isDone = t.status === "success";
            const statusLabel =
              t.status === "queued" ? "Queued…" :
              t.status === "signing" ? `Preparing… (attempt ${t.attempt}/${MAX_ATTEMPTS})` :
              t.status === "uploading" ? `Uploading ${t.progress}%${t.attempt > 1 ? ` — retry ${t.attempt}/${MAX_ATTEMPTS}` : ""}` :
              t.status === "success" ? "Uploaded" :
              t.status === "canceled" ? "Canceled" :
              `Failed: ${t.error || "Unknown error"}`;

            return (
              <li key={t.id} className="rounded border bg-muted/30 px-3 py-2 text-sm space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isDone ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> :
                     isError ? <AlertCircle className="w-4 h-4 text-destructive shrink-0" /> :
                     inFlight ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> :
                     <FileIcon className="w-4 h-4 shrink-0" />}
                    <span className="truncate">{t.file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({(t.file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {inFlight && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => cancelTask(t.id)} aria-label="Cancel upload">
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                    {(isError && !t.permanent) || isCanceled ? (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => retryTask(t.id)} aria-label="Retry upload">
                        <RotateCw className="w-4 h-4" />
                      </Button>
                    ) : null}
                    {(isError || isCanceled) && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => dismissTask(t.id)} aria-label="Dismiss">
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {(t.status === "uploading" || t.status === "signing" || t.status === "queued") && (
                  <Progress value={t.status === "uploading" ? t.progress : undefined} className="h-1.5" />
                )}
                <p className={`text-xs ${isError ? "text-destructive" : "text-muted-foreground"}`}>
                  {statusLabel}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={`${it.path}-${i}`} className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
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

function FieldRenderer({ field, form, companySlug, preview, onActiveChange }: { field: SupplierField; form: UseFormReturn<any>; companySlug?: string; preview?: boolean; onActiveChange?: (fieldKey: string, active: boolean) => void }) {
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
                onActiveChange={onActiveChange}
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
                  <FieldRenderer key={f.key} field={f} form={form} companySlug={companySlug} preview={preview} />
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
