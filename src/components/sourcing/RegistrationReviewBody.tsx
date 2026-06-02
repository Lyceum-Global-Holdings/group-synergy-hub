import { useEffect, useMemo, useState } from "react";
import { Download, FileText, ExternalLink } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSupplierFormConfig, DEFAULT_SUPPLIER_FORM_SCHEMA } from "@/hooks/useSupplierFormConfig";
import {
  SupplierField,
  SupplierFileValue,
  SupplierFormSchema,
  SupplierSection,
} from "@/lib/supplierFormSchema";
import { SupplierRegistrationRequest } from "@/types/supplierRegistration";

const BUCKET = "supplier-documents";

function isFileValue(v: any): v is SupplierFileValue {
  return v && typeof v === "object" && typeof v.path === "string" && typeof v.name === "string";
}

function FileLink({ file }: { file: SupplierFileValue }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = async () => {
    if (url) {
      window.open(url, "_blank", "noopener");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(file.path, 60 * 10);
    setLoading(false);
    if (!error && data?.signedUrl) {
      setUrl(data.signedUrl);
      window.open(data.signedUrl, "_blank", "noopener");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={open}
      disabled={loading}
      className="h-auto py-2 justify-start gap-2 max-w-full"
    >
      <FileText className="w-4 h-4 shrink-0" />
      <span className="truncate text-left">{file.name}</span>
      {typeof file.size === "number" && (
        <span className="text-xs text-muted-foreground shrink-0">
          {(file.size / 1024).toFixed(0)} KB
        </span>
      )}
      <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
    </Button>
  );
}

function renderValue(field: SupplierField, raw: any) {
  if (raw === null || raw === undefined || raw === "") {
    return <p className="text-sm mt-1 text-muted-foreground">—</p>;
  }
  if (field.type === "file") {
    const files: SupplierFileValue[] = Array.isArray(raw)
      ? raw.filter(isFileValue)
      : isFileValue(raw)
      ? [raw]
      : [];
    if (!files.length) return <p className="text-sm mt-1 text-muted-foreground">—</p>;
    return (
      <div className="mt-1 flex flex-col gap-2">
        {files.map((f, i) => (
          <FileLink key={i} file={f} />
        ))}
      </div>
    );
  }
  if (field.type === "checkbox") {
    return <p className="text-sm mt-1">{raw ? "Yes" : "No"}</p>;
  }
  if (field.type === "multiselect" && Array.isArray(raw)) {
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {raw.length === 0 ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          raw.map((v: string) => (
            <Badge key={v} variant="secondary">
              {v}
            </Badge>
          ))
        )}
      </div>
    );
  }
  if (field.type === "textarea") {
    return <p className="text-sm mt-1 whitespace-pre-wrap break-words">{String(raw)}</p>;
  }
  if (field.type === "url" && typeof raw === "string") {
    return (
      <a
        href={raw}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm mt-1 text-primary underline break-all inline-block"
      >
        {raw}
      </a>
    );
  }
  return <p className="text-sm mt-1 break-words">{String(raw)}</p>;
}

export function RegistrationReviewBody({
  registration,
}: {
  registration: SupplierRegistrationRequest;
}) {
  const { data: config } = useSupplierFormConfig(registration.company_id || undefined);
  const schema: SupplierFormSchema = config?.schema ?? DEFAULT_SUPPLIER_FORM_SCHEMA;
  const data: Record<string, any> = (registration.supplier_data as any) || {};

  // Collect keys covered by the schema so we can show "extras" at the end.
  const { sections, extraKeys } = useMemo(() => {
    const known = new Set<string>();
    const sortedSections = [...schema.sections].sort((a, b) => a.order - b.order);
    sortedSections.forEach((s) =>
      s.fields.forEach((f) => {
        if (f.visible !== false) known.add(f.key);
      }),
    );
    const extras = Object.keys(data).filter((k) => !known.has(k));
    return { sections: sortedSections, extraKeys: extras };
  }, [schema, data]);

  return (
    <div className="space-y-6">
      {sections.map((section: SupplierSection) => {
        const fields = section.fields
          .filter((f) => f.visible !== false)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        if (fields.length === 0) return null;
        return (
          <section key={section.id} className="space-y-3">
            <div className="border-b pb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h3>
              {section.description && (
                <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {fields.map((f) => {
                const fullWidth =
                  f.type === "textarea" || f.type === "file" || f.type === "multiselect";
                return (
                  <div key={f.key} className={fullWidth ? "md:col-span-2" : ""}>
                    <Label className="text-xs text-muted-foreground">
                      {f.label}
                      {f.required && <span className="text-destructive ml-0.5">*</span>}
                    </Label>
                    {renderValue(f, data[f.key])}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {extraKeys.length > 0 && (
        <section className="space-y-3">
          <div className="border-b pb-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Additional Information
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {extraKeys.map((k) => {
              const v = data[k];
              const fakeField: SupplierField = {
                key: k,
                label: k.replace(/^custom_/, "").replace(/_/g, " "),
                type: isFileValue(v) || (Array.isArray(v) && v.some(isFileValue)) ? "file" : "text",
                group: "custom",
                required: false,
                visible: true,
              };
              const fullWidth = fakeField.type === "file";
              return (
                <div key={k} className={fullWidth ? "md:col-span-2" : ""}>
                  <Label className="text-xs text-muted-foreground capitalize">
                    {fakeField.label}
                  </Label>
                  {renderValue(fakeField, v)}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {Array.isArray(registration.documents) && registration.documents.length > 0 && (
        <section className="space-y-3">
          <div className="border-b pb-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Download className="w-4 h-4" />
              Attached Documents ({registration.documents.length})
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {registration.documents.map((doc: any, i: number) => {
              if (isFileValue(doc)) {
                return <FileLink key={i} file={doc} />;
              }
              if (doc?.path && doc?.file_name) {
                return (
                  <FileLink
                    key={i}
                    file={{
                      path: doc.path,
                      name: doc.file_name,
                      size: doc.file_size ?? 0,
                      mime: doc.mime ?? "",
                    }}
                  />
                );
              }
              if (doc?.file_url) {
                return (
                  <a
                    key={i}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline inline-flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    {doc.file_name || doc.document_type || "Document"}
                  </a>
                );
              }
              return null;
            })}
          </div>
        </section>
      )}
    </div>
  );
}
