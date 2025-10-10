import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ContractDocument } from "@/types/contracts";

export const useContractDocuments = (contractId: string) => {
  return useQuery({
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
};

export const useContractDocumentMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const uploadDocument = useMutation({
    mutationFn: async ({
      contractId,
      file,
      documentType,
      documentName,
      description,
      versionNumber,
    }: {
      contractId: string;
      file: File;
      documentType: string;
      documentName: string;
      description?: string;
      versionNumber?: string;
    }) => {
      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${contractId}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("contract-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("contract-documents")
        .getPublicUrl(fileName);

      // Create document record
      const { data, error } = await supabase
        .from("contract_documents")
        .insert([
          {
            contract_id: contractId,
            document_type: documentType as any,
            document_name: documentName,
            file_path: fileName,
            file_url: urlData.publicUrl,
            file_size: file.size,
            mime_type: file.type,
            version_number: versionNumber || "1.0",
            description,
            uploaded_by: user?.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contract-documents", variables.contractId] });
      toast.success("Document uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to upload document: " + error.message);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async ({ id, filePath, contractId }: { id: string; filePath: string; contractId: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("contract-documents")
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete record
      const { error } = await supabase
        .from("contract_documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { contractId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contract-documents", data.contractId] });
      toast.success("Document deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete document: " + error.message);
    },
  });

  const updateDocumentStatus = useMutation({
    mutationFn: async ({
      id,
      contractId,
      isSigned,
      signatureStatus,
      esignPlatform,
      esignReferenceId,
    }: {
      id: string;
      contractId: string;
      isSigned?: boolean;
      signatureStatus?: string;
      esignPlatform?: string;
      esignReferenceId?: string;
    }) => {
      const { data, error } = await supabase
        .from("contract_documents")
        .update({
          is_signed: isSigned,
          signature_status: signatureStatus as any,
          esign_platform: esignPlatform,
          esign_reference_id: esignReferenceId,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return { data, contractId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contract-documents", result.contractId] });
      toast.success("Document status updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update document status: " + error.message);
    },
  });

  return {
    uploadDocument,
    deleteDocument,
    updateDocumentStatus,
  };
};
