import { useMemo, useState } from "react";
import { Plus, Trash2, Eye, Pencil, ArrowUp, ArrowDown, RotateCcw, Lock, FolderPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";

const BASELINE_SECTION_IDS = new Set(DEFAULT_SUPPLIER_FORM_SCHEMA.sections.map((s) => s.id));
const isBaselineSection = (id: string) => BASELINE_SECTION_IDS.has(id);

const sortedFields = (fields: SupplierField[]) =>
  fields
    .map((f, i) => ({ f, i, o: f.order ?? i }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map((x) => x.f);


export default function FormBuilder({ companyId }: FormBuilderProps) {
  const { data: config, isLoading } = useSupplierFormConfig(companyId);
  const save = useSaveSupplierFormConfig();

  const [draft, setDraft] = useState<SupplierFormSchema | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{ sectionId: string; field: SupplierField } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ sectionId: string; field: SupplierField } | null>(null);
  const [sectionDialog, setSectionDialog] = useState<{ mode: "add" } | { mode: "edit"; section: SupplierSection } | null>(null);
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<SupplierSection | null>(null);


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
      sections: s.sections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const maxOrder = sec.fields.reduce((m, f) => Math.max(m, f.order ?? 0), 0);
        return { ...sec, fields: [...sec.fields, { ...field, order: maxOrder + 1 }] };
      }),
    }));
  };

  const updateField = (sectionId: string, key: string, patch: Partial<SupplierField>) => {
    update((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id !== sectionId
          ? sec
          : { ...sec, fields: sec.fields.map((f) => (f.key === key ? { ...f, ...patch, key: f.key } : f)) },
      ),
    }));
  };

  const moveField = (sectionId: string, key: string, dir: -1 | 1) => {
    update((s) => ({
      ...s,
      sections: s.sections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const ordered = sortedFields(sec.fields);
        const idx = ordered.findIndex((f) => f.key === key);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= ordered.length) return sec;
        const next = ordered.slice();
        [next[idx], next[target]] = [next[target], next[idx]];
        return { ...sec, fields: next.map((f, i) => ({ ...f, order: i + 1 })) };
      }),
    }));
  };

  const restoreSectionDefaults = (sectionId: string) => {
    const baseSection = DEFAULT_SUPPLIER_FORM_SCHEMA.sections.find((s) => s.id === sectionId);
    if (!baseSection) return;
    update((s) => ({
      ...s,
      sections: s.sections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const customs = sec.fields.filter((f) => !f.baseline);
        return { ...sec, fields: [...baseSection.fields.map((f) => ({ ...f })), ...customs] };
      }),
    }));
    toast.success("Section defaults restored");
  };

  const addSection = (title: string, description: string) => {
    update((s) => {
      const base = `custom_${slugify(title)}`;
      const existingIds = new Set(s.sections.map((x) => x.id));
      let id = base;
      let n = 2;
      while (existingIds.has(id)) id = `${base}_${n++}`;
      const maxOrder = s.sections.reduce((m, x) => Math.max(m, x.order), 0);
      return {
        ...s,
        sections: [
          ...s.sections,
          { id, title: title.trim(), description: description.trim() || undefined, order: maxOrder + 1, fields: [] },
        ],
      };
    });
    toast.success("Section added");
  };

  const updateSection = (sectionId: string, patch: { title: string; description: string }) => {
    update((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id !== sectionId ? sec : { ...sec, title: patch.title.trim(), description: patch.description.trim() || undefined },
      ),
    }));
  };

  const removeSection = (sectionId: string) => {
    if (isBaselineSection(sectionId)) {
      toast.error("Baseline sections cannot be deleted");
      return;
    }
    update((s) => ({ ...s, sections: s.sections.filter((sec) => sec.id !== sectionId) }));
    toast.success("Section removed");
  };

  const moveSection = (sectionId: string, dir: -1 | 1) => {
    update((s) => {
      const ordered = s.sections.slice().sort((a, b) => a.order - b.order);
      const idx = ordered.findIndex((x) => x.id === sectionId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= ordered.length) return s;
      [ordered[idx], ordered[target]] = [ordered[target], ordered[idx]];
      return { ...s, sections: ordered.map((sec, i) => ({ ...sec, order: i + 1 })) };
    });
  };



  const handleSave = async (publish: boolean) => {
    try {
      await save.mutateAsync({ company_id: companyId, schema, publish });
      toast.success(publish ? "Form published — public link updated" : "Draft saved");
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
              Toggle fields on/off, edit labels, reorder, and add custom fields. Baseline fields
              follow international standards (PEPPOL, ISO 20022, GS1, ISO 17442, ISO 9362, ISO 4217)
              — they can be hidden and re-labelled but their key and type stay locked to preserve
              compliance, and they cannot be deleted. Click <strong>Publish changes</strong> to push
              edits to the public registration link.
              {config?.is_published && (
                <span className="ml-2"><Badge variant="outline">Published v{config.version}</Badge></span>
              )}
              {draft && (
                <span className="ml-2"><Badge variant="destructive">Unpublished changes</Badge></span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSectionDialog({ mode: "add" })}>
              <FolderPlus className="w-4 h-4 mr-2" /> Add section
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
              <Eye className="w-4 h-4 mr-2" /> Preview
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={save.isPending || !draft}>
              Save draft
            </Button>
            <Button size="sm" onClick={() => handleSave(true)} disabled={save.isPending || !draft}>
              Publish changes
            </Button>
          </div>

        </CardHeader>
      </Card>

      {(() => {
        const ordered = schema.sections.slice().sort((a, b) => a.order - b.order);
        return ordered.map((section, idx) => (
          <SectionEditor
            key={section.id}
            section={section}
            isBaseline={isBaselineSection(section.id)}
            canMoveUp={idx > 0}
            canMoveDown={idx < ordered.length - 1}
            onToggle={(key, prop, value) => toggleField(section.id, key, prop, value)}
            onRemove={(field) => setDeleteTarget({ sectionId: section.id, field })}
            onEdit={(field) => setEditTarget({ sectionId: section.id, field })}
            onMove={(key, dir) => moveField(section.id, key, dir)}
            onAdd={() => setAddOpen(section.id)}
            onRestore={() => restoreSectionDefaults(section.id)}
            onEditSection={() => setSectionDialog({ mode: "edit", section })}
            onDeleteSection={() => setDeleteSectionTarget(section)}
            onMoveSection={(dir) => moveSection(section.id, dir)}
          />
        ));
      })()}


      <FieldDialog
        mode="add"
        open={!!addOpen}
        existingKeys={schema.sections.flatMap((s) => s.fields.map((f) => f.key))}
        onClose={() => setAddOpen(null)}
        onSubmit={(f) => {
          if (addOpen) addCustomField(addOpen, f);
          setAddOpen(null);
        }}
      />

      {editTarget && (
        <FieldDialog
          mode="edit"
          open
          initial={editTarget.field}
          existingKeys={schema.sections.flatMap((s) => s.fields.map((f) => f.key))}
          onClose={() => setEditTarget(null)}
          onSubmit={(patch) => {
            updateField(editTarget.sectionId, editTarget.field.key, patch);
            setEditTarget(null);
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete field?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deleteTarget?.field.label}</strong> from the form. Submitted
              data for this field on existing draft requests will become orphaned. This cannot be
              undone except by adding the field again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) removeCustomField(deleteTarget.sectionId, deleteTarget.field.key);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Form Preview</DialogTitle></DialogHeader>
          <DynamicSupplierForm schema={schema} preview onSubmit={() => {}} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sectionDialog && (
        <SectionDialog
          mode={sectionDialog.mode}
          initial={sectionDialog.mode === "edit" ? sectionDialog.section : undefined}
          existingTitles={schema.sections.map((s) => s.title.toLowerCase())}
          onClose={() => setSectionDialog(null)}
          onSubmit={({ title, description }) => {
            if (sectionDialog.mode === "add") {
              addSection(title, description);
            } else {
              updateSection(sectionDialog.section.id, { title, description });
            }
            setSectionDialog(null);
          }}
        />
      )}

      <AlertDialog open={!!deleteSectionTarget} onOpenChange={(o) => !o && setDeleteSectionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete section?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the <strong>{deleteSectionTarget?.title}</strong> section and all
              {" "}{deleteSectionTarget?.fields.length ?? 0} field(s) inside it. Submitted data for
              those fields on existing draft requests will become orphaned. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSectionTarget) removeSection(deleteSectionTarget.id);
                setDeleteSectionTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SectionDialog({
  mode,
  initial,
  existingTitles,
  onClose,
  onSubmit,
}: {
  mode: "add" | "edit";
  initial?: SupplierSection;
  existingTitles: string[];
  onClose: () => void;
  onSubmit: (v: { title: string; description: string }) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  const submit = () => {
    const t = title.trim();
    if (!t) { toast.error("Section title is required"); return; }
    if (mode === "add" && existingTitles.includes(t.toLowerCase())) {
      toast.error("A section with this title already exists");
      return;
    }
    onSubmit({ title: t, description });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add new section" : "Rename section"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Section title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Certifications" />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="Short helper text shown under the section title" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{mode === "add" ? "Add section" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function SectionEditor({
  section,
  isBaseline,
  canMoveUp,
  canMoveDown,
  onToggle,
  onRemove,
  onEdit,
  onMove,
  onAdd,
  onRestore,
  onEditSection,
  onDeleteSection,
  onMoveSection,
}: {
  section: SupplierSection;
  isBaseline: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: (key: string, prop: "visible" | "required", value: boolean) => void;
  onRemove: (field: SupplierField) => void;
  onEdit: (field: SupplierField) => void;
  onMove: (key: string, dir: -1 | 1) => void;
  onAdd: () => void;
  onRestore: () => void;
  onEditSection: () => void;
  onDeleteSection: () => void;
  onMoveSection: (dir: -1 | 1) => void;
}) {
  const ordered = sortedFields(section.fields);
  const hasBaseline = section.fields.some((f) => f.baseline);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{section.title}</CardTitle>
              {isBaseline ? (
                <Badge variant="secondary" className="text-xs">baseline</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">custom</Badge>
              )}
            </div>
            {section.description && <CardDescription>{section.description}</CardDescription>}
          </div>
        </div>
        <div className="flex gap-1 items-center">
          <Button variant="ghost" size="icon" onClick={() => onMoveSection(-1)} disabled={!canMoveUp} title="Move section up">
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onMoveSection(1)} disabled={!canMoveDown} title="Move section down">
            <ArrowDown className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onEditSection} title="Rename section">
            <Pencil className="w-4 h-4 mr-1" /> Rename
          </Button>
          {hasBaseline && (
            <Button variant="ghost" size="sm" onClick={onRestore} title="Restore baseline defaults for this section">
              <RotateCcw className="w-4 h-4 mr-1" /> Restore defaults
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add custom field
          </Button>
          {isBaseline ? (
            <Button variant="ghost" size="icon" disabled title="Baseline section cannot be deleted">
              <Lock className="w-4 h-4 opacity-50" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={onDeleteSection} title="Delete section">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}

        </div>
      </CardHeader>
      <CardContent className="divide-y">
        {ordered.map((f, idx) => (
          <div key={f.key} className="flex items-center justify-between py-2 gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{f.label}</span>
                <Badge variant="outline" className="text-xs">{f.type}</Badge>
                {f.baseline && <Badge variant="secondary" className="text-xs">baseline</Badge>}
              </div>
              {f.help && <p className="text-xs text-muted-foreground truncate">{f.help}</p>}
            </div>
            <div className="flex items-center gap-3">
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
              <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={() => onMove(f.key, -1)} disabled={idx === 0} title="Move up">
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onMove(f.key, 1)} disabled={idx === ordered.length - 1} title="Move down">
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onEdit(f)} title="Edit field">
                  <Pencil className="w-4 h-4" />
                </Button>
                {f.baseline ? (
                  <Button variant="ghost" size="icon" disabled title="Baseline field cannot be deleted">
                    <Lock className="w-4 h-4 opacity-50" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => onRemove(f)} title="Delete field">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface FieldDialogProps {
  mode: "add" | "edit";
  open: boolean;
  initial?: SupplierField;
  existingKeys: string[];
  onClose: () => void;
  onSubmit: (field: SupplierField) => void;
}

function FieldDialog({ mode, open, initial, existingKeys, onClose, onSubmit }: FieldDialogProps) {
  const isBaseline = !!initial?.baseline;
  const isEdit = mode === "edit";

  const [label, setLabel] = useState(initial?.label ?? "");
  const [type, setType] = useState<SupplierFieldType>(initial?.type ?? "text");
  const [required, setRequired] = useState(initial?.required ?? false);
  const [visible, setVisible] = useState(initial?.visible ?? true);
  const [help, setHelp] = useState(initial?.help ?? "");
  const [placeholder, setPlaceholder] = useState(initial?.placeholder ?? "");
  const [optionsText, setOptionsText] = useState(
    initial?.options?.map((o) => o.label).join(", ") ?? "",
  );
  const [accept, setAccept] = useState<string[]>(
    initial?.accept ?? ["application/pdf", "image/jpeg", "image/png"],
  );
  const [maxSizeMB, setMaxSizeMB] = useState(initial?.maxSizeMB ?? 10);
  const [multiple, setMultiple] = useState(initial?.multiple ?? false);
  const [maxFiles, setMaxFiles] = useState(initial?.maxFiles ?? 1);
  const [pattern, setPattern] = useState(initial?.pattern ?? "");
  const [patternMessage, setPatternMessage] = useState(initial?.patternMessage ?? "");

  const reset = () => {
    setLabel(""); setType("text"); setRequired(false); setVisible(true);
    setHelp(""); setPlaceholder(""); setOptionsText("");
    setAccept(["application/pdf", "image/jpeg", "image/png"]);
    setMaxSizeMB(10); setMultiple(false); setMaxFiles(1);
    setPattern(""); setPatternMessage("");
  };

  const close = () => { if (!isEdit) reset(); onClose(); };

  const togglePreset = (mimes: string[]) => {
    const allOn = mimes.every((m) => accept.includes(m));
    setAccept((prev) =>
      allOn ? prev.filter((m) => !mimes.includes(m)) : Array.from(new Set([...prev, ...mimes])),
    );
  };

  const typeLocked = isEdit && isBaseline;

  const generatedKey = useMemo(() => {
    if (isEdit) return initial!.key;
    const base = `custom_${slugify(label)}`;
    if (!existingKeys.includes(base)) return base;
    let n = 2;
    while (existingKeys.includes(`${base}_${n}`)) n++;
    return `${base}_${n}`;
  }, [label, isEdit, initial, existingKeys]);

  const submit = () => {
    if (!label.trim()) { toast.error("Label is required"); return; }
    if (type === "select") {
      const opts = optionsText.split(",").map((s) => s.trim()).filter(Boolean);
      if (opts.length === 0) { toast.error("Select needs at least one option"); return; }
    }
    if (type === "file" && accept.length === 0) {
      toast.error("Pick at least one allowed file type"); return;
    }

    const options =
      type === "select"
        ? optionsText.split(",").map((s) => s.trim()).filter(Boolean).map((v) => ({ label: v, value: v }))
        : undefined;
    const fileProps = type === "file"
      ? { accept, maxSizeMB, multiple, maxFiles: multiple ? Math.max(1, maxFiles) : 1 }
      : { accept: undefined, maxSizeMB: undefined, multiple: undefined, maxFiles: undefined };

    const next: SupplierField = {
      key: generatedKey,
      label: label.trim(),
      type: typeLocked ? initial!.type : type,
      group: initial?.group ?? "custom",
      required,
      visible,
      baseline: initial?.baseline,
      help: help.trim() || undefined,
      placeholder: placeholder.trim() || undefined,
      options,
      pattern: pattern.trim() || undefined,
      patternMessage: patternMessage.trim() || undefined,
      order: initial?.order,
      ...fileProps,
    };

    if (isEdit && !isBaseline && initial && initial.type !== type) {
      toast.warning("Field type changed — previously collected values for this field may no longer match.");
    }

    onSubmit(next);
    if (!isEdit) reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit field${isBaseline ? " (baseline)" : ""}` : "Add custom field"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isBaseline && (
            <div className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 mt-0.5" />
              <span>
                Standards-compliant field. <strong>Key</strong> (<code>{initial!.key}</code>) and
                <strong> type</strong> (<code>{initial!.type}</code>) are locked to preserve PEPPOL /
                ISO 20022 / GS1 mapping. You can re-label, change help text, placeholder, and
                visibility / required.
              </span>
            </div>
          )}

          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Business Registration Certificate" />
          </div>

          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as SupplierFieldType)} disabled={typeLocked}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Help text (optional)</Label>
            <Textarea value={help} onChange={(e) => setHelp(e.target.value)} rows={2} placeholder="Short explanation shown below the field" />
          </div>

          {type !== "checkbox" && type !== "file" && (
            <div>
              <Label>Placeholder (optional)</Label>
              <Input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} />
            </div>
          )}

          {type === "select" && (
            <div>
              <Label>Options (comma-separated)</Label>
              <Input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Small, Medium, Large" />
            </div>
          )}

          {type === "file" && (
            <div className="space-y-3 rounded-md border p-3">
              <div>
                <Label className="text-xs">Allowed file types</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {FILE_ACCEPT_PRESETS.map((p) => {
                    const on = p.mimes.every((m) => accept.includes(m));
                    return (
                      <Button key={p.label} type="button" size="sm"
                        variant={on ? "default" : "outline"}
                        onClick={() => togglePreset(p.mimes)}>
                        {p.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Max size (MB)</Label>
                  <Input type="number" min={1} max={50} value={maxSizeMB}
                    onChange={(e) => setMaxSizeMB(Math.max(1, Math.min(50, Number(e.target.value) || 10)))} />
                </div>
                <div>
                  <Label className="text-xs">Max files</Label>
                  <Input type="number" min={1} max={10} value={maxFiles} disabled={!multiple}
                    onChange={(e) => setMaxFiles(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={multiple} onCheckedChange={setMultiple} />
                <Label className="text-xs">Allow multiple files</Label>
              </div>
            </div>
          )}

          {!isBaseline && (type === "text" || type === "tel" || type === "url" || type === "email") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Validation regex (optional)</Label>
                <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="^[A-Z0-9]+$" />
              </div>
              <div>
                <Label className="text-xs">Validation message</Label>
                <Input value={patternMessage} onChange={(e) => setPatternMessage(e.target.value)} placeholder="Use uppercase letters and numbers only" />
              </div>
            </div>
          )}

          <Separator />
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={visible} onCheckedChange={setVisible} />
              <Label>Visible</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={required} onCheckedChange={setRequired} disabled={!visible} />
              <Label>Required</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button onClick={submit}>{isEdit ? "Save changes" : "Add field"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
