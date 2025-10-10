import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ContractDocument } from "@/types/contracts";

export const useContractDocuments = (contractId: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["contract-documents", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_documents")
        .select("*")
        .eq("contract_id", contractId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data as ContractDocument[];
    },
    enabled: !!contractId,
  });

  const uploadDocument = useMutation({
    mutationFn: async ({
      file,
      documentType,
      description,
      versionNumber,
    }: {
      file: File;
      documentType: string;
      description?: string;
      versionNumber?: string;
    }) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${contractId}/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("contract-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("contract-documents")
        .getPublicUrl(filePath);

      const { data, error } = await supabase
        .from("contract_documents")
        .insert({
          contract_id: contractId,
          document_type: documentType as any,
          document_name: file.name,
          file_path: filePath,
          file_url: urlData.publicUrl,
          file_size: file.size,
          mime_type: file.type,
          version_number: versionNumber || "1.0",
          description,
          uploaded_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-documents", contractId] });
      toast.success("Document uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to upload document: " + error.message);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (documentId: string) => {
      const { data: doc } = await supabase
        .from("contract_documents")
        .select("file_path")
        .eq("id", documentId)
        .single();

      if (doc?.file_path) {
        await supabase.storage
          .from("contract-documents")
          .remove([doc.file_path]);
      }

      const { error } = await supabase
        .from("contract_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-documents", contractId] });
      toast.success("Document deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete document: " + error.message);
    },
  });

  const downloadDocument = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("contract-documents")
        .download(filePath);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Document downloaded");
    } catch (error: any) {
      toast.error("Failed to download: " + error.message);
    }
  };

  const updateDocumentStatus = useMutation({
    mutationFn: async ({
      documentId,
      signatureStatus,
      isSigned,
    }: {
      documentId: string;
      signatureStatus?: string;
      isSigned?: boolean;
    }) => {
      const { error } = await supabase
        .from("contract_documents")
        .update({
          signature_status: signatureStatus as any,
          is_signed: isSigned,
        })
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-documents", contractId] });
      toast.success("Document status updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  return {
    documents,
    isLoading,
    uploadDocument,
    deleteDocument,
    downloadDocument,
    updateDocumentStatus,
  };
};
