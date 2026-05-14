import { useState } from "react";
import { Plus, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  DEFAULT_SUPPLIER_FORM_SCHEMA,
  SupplierField,
  SupplierFieldType,
  SupplierFormSchema,
  SupplierSection,
  mergeWithBaseline,
} from "@/lib/supplierFormSchema";
import { useSupplierFormConfig, useSaveSupplierFormConfig } from "@/hooks/useSupplierFormConfig";
import DynamicSupplierForm from "./DynamicSupplierForm";

interface FormBuilderProps {
  companyId: string;
}

const FIELD_TYPES: { label: string; value: SupplierFieldType }[] = [
  { label: "Text", value: "text" },
  { label: "Email", value: "email" },
  { label: "Phone", value: "tel" },
  { label: "URL", value: "url" },
  { label: "Number", value: "number" },
  { label: "Date", value: "date" },
  { label: "Long text", value: "textarea" },
  { label: "Select", value: "select" },
  { label: "Checkbox", value: "checkbox" },
  { label: "File upload", value: "file" },
];

const FILE_ACCEPT_PRESETS: { label: string; mimes: string[] }[] = [
  { label: "PDF", mimes: ["application/pdf"] },
  { label: "Image (JPG/PNG)", mimes: ["image/jpeg", "image/png"] },
  { label: "Word (DOC/DOCX)", mimes: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  { label: "Excel (XLS/XLSX)", mimes: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] },
];

export default function FormBuilder({ companyId }: FormBuilderProps) {
  const { data: config, isLoading } = useSupplierFormConfig(companyId);
  const save = useSaveSupplierFormConfig();

  const [draft, setDraft] = useState<SupplierFormSchema | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [addOpen, setAddOpen] = useState<string | null>(null);

  const schema: SupplierFormSchema =
    draft || config?.schema || mergeWithBaseline(DEFAULT_SUPPLIER_FORM_SCHEMA);

  const update = (updater: (s: SupplierFormSchema) => SupplierFormSchema) => {
    setDraft(updater(schema));
  };

  const toggleField = (sectionId: string, key: string, prop: "visible" | "required", value: boolean) => {
    update((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id !== sectionId
          ? sec
          : { ...sec, fields: sec.fields.map((f) => (f.key === key ? { ...f, [prop]: value } : f)) },
      ),
    }));
  };

  const removeCustomField = (sectionId: string, key: string) => {
    update((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id !== sectionId ? sec : { ...sec, fields: sec.fields.filter((f) => f.key !== key) },
      ),
    }));
  };

  const addCustomField = (sectionId: string, field: SupplierField) => {
    update((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id !== sectionId ? sec : { ...sec, fields: [...sec.fields, field] },
      ),
    }));
  };

  const handleSave = async (publish: boolean) => {
    try {
      await save.mutateAsync({ company_id: companyId, schema, publish });
      toast.success(publish ? "Form published" : "Draft saved");
      setDraft(null);
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    }
  };

  if (isLoading) return <div className="text-muted-foreground p-4">Loading form configuration...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Form Builder</CardTitle>
            <CardDescription>
              Toggle fields on/off, mark them required, and add custom fields. Baseline fields
              follow international standards (PEPPOL, ISO 20022, GS1) and cannot be removed.
              {config?.is_published && (
                <span className="ml-2"><Badge variant="outline">Published v{config.version}</Badge></span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
              <Eye className="w-4 h-4 mr-2" /> Preview
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={save.isPending || !draft}>
              Save draft
            </Button>
            <Button size="sm" onClick={() => handleSave(true)} disabled={save.isPending}>
              Publish
            </Button>
          </div>
        </CardHeader>
      </Card>

      {schema.sections
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <SectionEditor
            key={section.id}
            section={section}
            onToggle={(key, prop, value) => toggleField(section.id, key, prop, value)}
            onRemove={(key) => removeCustomField(section.id, key)}
            onAdd={() => setAddOpen(section.id)}
          />
        ))}

      <AddFieldDialog
        open={!!addOpen}
        onClose={() => setAddOpen(null)}
        onAdd={(f) => {
          if (addOpen) addCustomField(addOpen, f);
          setAddOpen(null);
        }}
      />

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Form Preview</DialogTitle></DialogHeader>
          <DynamicSupplierForm schema={schema} preview onSubmit={() => {}} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionEditor({
  section,
  onToggle,
  onRemove,
  onAdd,
}: {
  section: SupplierSection;
  onToggle: (key: string, prop: "visible" | "required", value: boolean) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{section.title}</CardTitle>
          {section.description && <CardDescription>{section.description}</CardDescription>}
        </div>
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="w-4 h-4 mr-1" /> Add custom field
        </Button>
      </CardHeader>
      <CardContent className="divide-y">
        {section.fields.map((f) => (
          <div key={f.key} className="flex items-center justify-between py-2 gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{f.label}</span>
                <Badge variant="outline" className="text-xs">{f.type}</Badge>
                {f.baseline && <Badge variant="secondary" className="text-xs">baseline</Badge>}
              </div>
              {f.help && <p className="text-xs text-muted-foreground truncate">{f.help}</p>}
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Visible</Label>
                <Switch checked={f.visible} onCheckedChange={(v) => onToggle(f.key, "visible", v)} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Required</Label>
                <Switch
                  checked={f.required}
                  onCheckedChange={(v) => onToggle(f.key, "required", v)}
                  disabled={!f.visible}
                />
              </div>
              {!f.baseline && (
                <Button variant="ghost" size="icon" onClick={() => onRemove(f.key)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AddFieldDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (field: SupplierField) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<SupplierFieldType>("text");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");

  const reset = () => { setLabel(""); setType("text"); setRequired(false); setOptionsText(""); };

  const submit = () => {
    if (!label.trim()) { toast.error("Label is required"); return; }
    const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${Date.now().toString(36)}`;
    const options =
      type === "select"
        ? optionsText.split(",").map((s) => s.trim()).filter(Boolean).map((v) => ({ label: v, value: v }))
        : undefined;
    onAdd({
      key,
      label: label.trim(),
      type,
      group: "custom",
      required,
      visible: true,
      options,
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add custom field</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. ISO 9001 certificate number" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as SupplierFieldType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type === "select" && (
            <div>
              <Label>Options (comma-separated)</Label>
              <Input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Small, Medium, Large" />
            </div>
          )}
          <Separator />
          <div className="flex items-center gap-2">
            <Switch checked={required} onCheckedChange={setRequired} />
            <Label>Required</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={submit}>Add field</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
