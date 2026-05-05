import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Download, X, Camera, Image as ImageIcon } from "lucide-react";

const BUCKET = "min-srn-documents";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];

interface SrnDocumentUploadFieldProps {
  /** Owning company id — used as the first path segment for RLS. */
  companyId?: string;
  /** Existing MIN id (when editing). If omitted, files are uploaded under a `temp/` folder. */
  minId?: string;
  /** Current stored object path. */
  currentDocumentUrl?: string;
  /** Notifies parent of the new path (or empty string if removed). */
  onUpload: (path: string) => void;
  /** When true, persists the path to material_issue_notes.srn_document_url after upload/remove. */
  persistOnChange?: boolean;
  disabled?: boolean;
  label?: string;
}

export function SrnDocumentUploadField({
  companyId,
  minId,
  currentDocumentUrl,
  onUpload,
  persistOnChange = false,
  disabled,
  label = "SRN Document (photo / scan)",
}: SrnDocumentUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [documentPath, setDocumentPath] = useState<string | undefined>(currentDocumentUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDocumentPath(currentDocumentUrl);
  }, [currentDocumentUrl]);

  // Generate short-lived signed URL for preview (images only).
  useEffect(() => {
    let active = true;
    (async () => {
      if (!documentPath) {
        setPreviewUrl(null);
        return;
      }
      const isImage = /\.(jpe?g|png|webp)$/i.test(documentPath);
      if (!isImage) {
        setPreviewUrl(null);
        return;
      }
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(documentPath, 120);
      if (active) setPreviewUrl(data?.signedUrl ?? null);
    })();
    return () => {
      active = false;
    };
  }, [documentPath]);

  const persist = async (newPath: string | null) => {
    if (!persistOnChange || !minId) return;
    const { error } = await supabase
      .from("material_issue_notes")
      .update({ srn_document_url: newPath })
      .eq("id", minId);
    if (error) throw error;
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!companyId) {
      toast({
        title: "Company required",
        description: "Select a company before uploading the SRN document.",
        variant: "destructive",
      });
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Use JPG, PNG, WEBP or PDF.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({
        title: "File too large",
        description: "Maximum size is 5MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const folder = minId ?? "temp";
      const path = `${companyId}/${folder}/srn_${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;

      // Best-effort cleanup of the previous file.
      if (documentPath && documentPath !== data.path) {
        await supabase.storage.from(BUCKET).remove([documentPath]).catch(() => {});
      }

      await persist(data.path);
      setDocumentPath(data.path);
      onUpload(data.path);
      toast({ title: "SRN document uploaded" });
    } catch (e: any) {
      console.error("SRN upload failed", e);
      toast({
        title: "Upload failed",
        description: e.message ?? "Could not upload SRN document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleDownload = async () => {
    if (!documentPath) return;
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(documentPath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = documentPath.split("/").pop() ?? "srn-document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  };

  const handleRemove = async () => {
    if (!documentPath) return;
    try {
      await supabase.storage.from(BUCKET).remove([documentPath]).catch(() => {});
      await persist(null);
      setDocumentPath(undefined);
      onUpload("");
      toast({ title: "SRN document removed" });
    } catch (e: any) {
      toast({ title: "Remove failed", description: e.message, variant: "destructive" });
    }
  };

  const isPdf = documentPath ? /\.pdf$/i.test(documentPath) : false;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {documentPath ? (
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/40">
          {previewUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img
              src={previewUrl}
              alt="SRN preview"
              className="h-14 w-14 object-cover rounded border"
            />
          ) : isPdf ? (
            <FileText className="h-8 w-8 text-muted-foreground" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {documentPath.split("/").pop()}
            </p>
            <p className="text-xs text-muted-foreground">SRN evidence on file</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleDownload} disabled={disabled}>
            <Download className="h-4 w-4" />
          </Button>
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => handleFile(e.target.files?.[0])}
            disabled={uploading || disabled}
            className="hidden"
          />
          <Input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFile(e.target.files?.[0])}
            disabled={uploading || disabled}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading || disabled}
              className="flex-1"
            >
              <Camera className="h-4 w-4" />
              {uploading ? "Uploading..." : "Take photo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || disabled}
              className="flex-1"
            >
              <Upload className="h-4 w-4" />
              Choose file
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Attach a photo or scan of the signed SRN. JPG, PNG, WEBP or PDF — max 5MB.
          </p>
        </div>
      )}
    </div>
  );
}
