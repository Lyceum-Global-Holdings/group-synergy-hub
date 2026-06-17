import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type MaterialAttachmentParentType =
  | "material_issue"
  | "material_return"
  | "material_request";

export type MaterialAttachmentCategory =
  | "signed_srn"
  | "gate_pass"
  | "photo"
  | "delivery_proof"
  | "other";

export interface MaterialAttachment {
  id: string;
  parent_type: MaterialAttachmentParentType;
  parent_id: string;
  company_id: string;
  category: MaterialAttachmentCategory;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export const MATERIAL_ATTACHMENT_BUCKET = "min-srn-documents";
export const MATERIAL_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const MATERIAL_ATTACHMENT_ALLOWED = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const MATERIAL_ATTACHMENT_CATEGORIES: {
  value: MaterialAttachmentCategory;
  label: string;
}[] = [
  { value: "signed_srn", label: "Signed SRN" },
  { value: "gate_pass", label: "Gate Pass" },
  { value: "photo", label: "Photo" },
  { value: "delivery_proof", label: "Delivery Proof" },
  { value: "other", label: "Other" },
];

export interface BufferedAttachment {
  tempId: string;
  category: MaterialAttachmentCategory;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
}

function uploadPath(companyId: string, scope: string, file: File): string {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  return `${companyId}/${scope}/mda_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
}

export function validateAttachmentFile(file: File): string | null {
  if (!MATERIAL_ATTACHMENT_ALLOWED.includes(file.type)) {
    return "Use JPG, PNG, WEBP or PDF.";
  }
  if (file.size > MATERIAL_ATTACHMENT_MAX_BYTES) {
    return "Maximum size is 5MB per file.";
  }
  return null;
}

/** Upload one file to storage and return its path + metadata (no DB row). */
export async function uploadAttachmentFile(
  companyId: string,
  scope: string,
  file: File,
): Promise<BufferedAttachment> {
  const path = uploadPath(companyId, scope, file);
  const { data, error } = await supabase.storage
    .from(MATERIAL_ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return {
    tempId: crypto.randomUUID(),
    category: "other",
    file_path: data.path,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
  };
}

/** Persist buffered attachments to DB after parent record is created. */
export async function commitBufferedAttachments(
  parentType: MaterialAttachmentParentType,
  parentId: string,
  companyId: string,
  buffered: BufferedAttachment[],
): Promise<void> {
  if (!buffered.length) return;
  const { data: authData } = await supabase.auth.getUser();
  const uploadedBy = authData.user?.id ?? null;
  const rows = buffered.map((b) => ({
    parent_type: parentType,
    parent_id: parentId,
    company_id: companyId,
    category: b.category,
    file_path: b.file_path,
    file_name: b.file_name,
    mime_type: b.mime_type,
    file_size: b.file_size,
    uploaded_by: uploadedBy,
  }));
  const { error } = await supabase
    .from("material_document_attachments")
    .insert(rows);
  if (error) throw error;
}

export function useMaterialAttachments(
  parentType: MaterialAttachmentParentType,
  parentId: string | undefined,
) {
  const qc = useQueryClient();
  const key = ["material-attachments", parentType, parentId];

  const list = useQuery({
    queryKey: key,
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_document_attachments")
        .select("*")
        .eq("parent_type", parentType)
        .eq("parent_id", parentId!)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MaterialAttachment[];
    },
  });

  const upload = useMutation({
    mutationFn: async ({
      file,
      category,
      companyId,
    }: {
      file: File;
      category: MaterialAttachmentCategory;
      companyId: string;
    }) => {
      if (!parentId) throw new Error("Parent record not saved yet");
      const err = validateAttachmentFile(file);
      if (err) throw new Error(err);
      const buffered = await uploadAttachmentFile(companyId, parentId, file);
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("material_document_attachments")
        .insert({
          parent_type: parentType,
          parent_id: parentId,
          company_id: companyId,
          category,
          file_path: buffered.file_path,
          file_name: buffered.file_name,
          mime_type: buffered.mime_type,
          file_size: buffered.file_size,
          uploaded_by: authData.user?.id ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Attachment uploaded" });
    },
    onError: (e: Error) =>
      toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const updateCategory = useMutation({
    mutationFn: async ({
      id,
      category,
    }: {
      id: string;
      category: MaterialAttachmentCategory;
    }) => {
      const { error } = await supabase
        .from("material_document_attachments")
        .update({ category })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (att: MaterialAttachment) => {
      await supabase.storage
        .from(MATERIAL_ATTACHMENT_BUCKET)
        .remove([att.file_path])
        .catch(() => {});
      const { error } = await supabase
        .from("material_document_attachments")
        .delete()
        .eq("id", att.id)
        .select("id");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Attachment removed" });
    },
    onError: (e: Error) =>
      toast({ title: "Remove failed", description: e.message, variant: "destructive" }),
  });

  return { list, upload, updateCategory, remove };
}

export async function getAttachmentSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from(MATERIAL_ATTACHMENT_BUCKET)
    .createSignedUrl(path, 120);
  return data?.signedUrl ?? null;
}

export async function downloadAttachment(path: string, fallbackName?: string) {
  const { data, error } = await supabase.storage
    .from(MATERIAL_ATTACHMENT_BUCKET)
    .download(path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName || path.split("/").pop() || "attachment";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
