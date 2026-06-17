import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Upload, X, Download, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  BufferedAttachment,
  MATERIAL_ATTACHMENT_CATEGORIES,
  MaterialAttachmentCategory,
  MaterialAttachmentParentType,
  downloadAttachment,
  getAttachmentSignedUrl,
  uploadAttachmentFile,
  useMaterialAttachments,
  validateAttachmentFile,
  MATERIAL_ATTACHMENT_BUCKET,
} from "@/hooks/useMaterialAttachments";
import { supabase } from "@/integrations/supabase/client";

const MAX_FILES = 10;

interface Props {
  parentType: MaterialAttachmentParentType;
  parentId?: string;
  companyId?: string;
  disabled?: boolean;
  label?: string;
  /** Buffered mode only — parent must commit on save. */
  buffered?: BufferedAttachment[];
  onBufferedChange?: (next: BufferedAttachment[]) => void;
}

function FileIcon({ mime, path }: { mime?: string | null; path: string }) {
  const isImage = /^image\//i.test(mime || "") || /\.(jpe?g|png|webp)$/i.test(path);
  const isPdf = /pdf/i.test(mime || "") || /\.pdf$/i.test(path);
  if (isImage) return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
  if (isPdf) return <FileText className="h-5 w-5 text-muted-foreground" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

function formatSize(b?: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function MaterialAttachmentsPanel({
  parentType,
  parentId,
  companyId,
  disabled,
  label = "Attachments",
  buffered,
  onBufferedChange,
}: Props) {
  const isBuffered = !parentId;
  const { list, upload, updateCategory, remove } = useMaterialAttachments(
    parentType,
    parentId,
  );

  const [busy, setBusy] = useState(false);
  const [pendingCategory, setPendingCategory] =
    useState<MaterialAttachmentCategory>("signed_srn");
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const rows = isBuffered
    ? (buffered ?? []).map((b) => ({
        id: b.tempId,
        category: b.category,
        file_path: b.file_path,
        file_name: b.file_name,
        mime_type: b.mime_type,
        file_size: b.file_size,
        uploaded_at: null as string | null,
        _buffered: true as const,
        _raw: b,
      }))
    : (list.data ?? []).map((a) => ({
        id: a.id,
        category: a.category,
        file_path: a.file_path,
        file_name: a.file_name,
        mime_type: a.mime_type,
        file_size: a.file_size,
        uploaded_at: a.uploaded_at,
        _buffered: false as const,
        _raw: a,
      }));

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!companyId) {
      toast({
        title: "Company required",
        description: "Select a company first.",
        variant: "destructive",
      });
      return;
    }
    if (rows.length + files.length > MAX_FILES) {
      toast({
        title: "Too many files",
        description: `Maximum ${MAX_FILES} files per document.`,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const err = validateAttachmentFile(file);
        if (err) {
          toast({ title: file.name, description: err, variant: "destructive" });
          continue;
        }
        if (isBuffered) {
          const buf = await uploadAttachmentFile(
            companyId,
            `temp-${Date.now()}`,
            file,
          );
          buf.category = pendingCategory;
          onBufferedChange?.([...(buffered ?? []), buf]);
        } else {
          await upload.mutateAsync({ file, category: pendingCategory, companyId });
        }
      }
    } catch (e: any) {
      toast({
        title: "Upload failed",
        description: e.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      if (camRef.current) camRef.current.value = "";
    }
  };

  const handleRemove = async (row: (typeof rows)[number]) => {
    if (row._buffered) {
      await supabase.storage
        .from(MATERIAL_ATTACHMENT_BUCKET)
        .remove([row.file_path])
        .catch(() => {});
      onBufferedChange?.((buffered ?? []).filter((b) => b.tempId !== row.id));
    } else {
      await remove.mutateAsync(row._raw as any);
    }
  };

  const handleChangeCategory = async (
    row: (typeof rows)[number],
    cat: MaterialAttachmentCategory,
  ) => {
    if (row._buffered) {
      onBufferedChange?.(
        (buffered ?? []).map((b) =>
          b.tempId === row.id ? { ...b, category: cat } : b,
        ),
      );
    } else {
      await updateCategory.mutateAsync({ id: row.id, category: cat });
    }
  };

  const handleOpen = async (path: string, name?: string | null) => {
    const url = await getAttachmentSignedUrl(path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else
      downloadAttachment(path, name || undefined).catch((e) =>
        toast({ title: "Open failed", description: e.message, variant: "destructive" }),
      );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">
          {rows.length}/{MAX_FILES} files
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={pendingCategory}
          onValueChange={(v) => setPendingCategory(v as MaterialAttachmentCategory)}
          disabled={disabled || busy}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATERIAL_ATTACHMENT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || busy}
          className="hidden"
        />
        <Input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || busy}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => camRef.current?.click()}
          disabled={disabled || busy || rows.length >= MAX_FILES}
        >
          <Camera className="h-4 w-4 mr-1" /> Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || busy || rows.length >= MAX_FILES}
        >
          <Upload className="h-4 w-4 mr-1" /> Choose files
        </Button>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <p className="text-xs text-muted-foreground">
        JPG, PNG, WEBP or PDF — up to {MAX_FILES} files, max 5MB each. Pick a category
        before uploading; the first “Signed SRN” is used as primary evidence on PDFs.
      </p>

      {list.isLoading && !isBuffered && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading attachments…
        </div>
      )}

      {rows.length > 0 && (
        <div className="border rounded-md divide-y">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 p-2 bg-muted/30"
            >
              <FileIcon mime={row.mime_type} path={row.file_path} />
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  className="text-sm font-medium truncate text-left hover:underline w-full block"
                  onClick={() => handleOpen(row.file_path, row.file_name)}
                  title={row.file_name || row.file_path}
                >
                  {row.file_name || row.file_path.split("/").pop()}
                </button>
                <p className="text-xs text-muted-foreground">
                  {formatSize(row.file_size)}
                  {row.uploaded_at
                    ? ` · ${new Date(row.uploaded_at).toLocaleString()}`
                    : " · pending save"}
                </p>
              </div>
              <Select
                value={row.category}
                onValueChange={(v) =>
                  handleChangeCategory(row, v as MaterialAttachmentCategory)
                }
                disabled={disabled}
              >
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_ATTACHMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  downloadAttachment(row.file_path, row.file_name || undefined).catch(
                    (e) =>
                      toast({
                        title: "Download failed",
                        description: e.message,
                        variant: "destructive",
                      }),
                  )
                }
                disabled={disabled}
              >
                <Download className="h-4 w-4" />
              </Button>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(row)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
