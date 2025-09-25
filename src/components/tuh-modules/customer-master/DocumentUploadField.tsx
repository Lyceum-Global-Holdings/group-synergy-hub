import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Download, X } from "lucide-react";

interface DocumentUploadFieldProps {
  customerId: string;
  currentDocumentUrl?: string;
  onUpload: (url: string) => void;
  label?: string;
}

export function DocumentUploadField({ 
  customerId, 
  currentDocumentUrl, 
  onUpload,
  label = "Business Registration Document"
}: DocumentUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documentUrl, setDocumentUrl] = useState(currentDocumentUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or image file (JPG, PNG)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const fileName = `${customerId}/documents/br_${Date.now()}_${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('customer-documents')
        .upload(fileName, file);

      if (error) throw error;

      setDocumentUrl(data.path);
      onUpload(data.path);

      // Update customer record with document URL
      const { error: updateError } = await supabase
        .from('customers')
        .update({ company_registration_document_url: data.path })
        .eq('id', customerId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async () => {
    if (!documentUrl) return;

    try {
      const { data, error } = await supabase.storage
        .from('customer-documents')
        .download(documentUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customer_document_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message || "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const handleRemove = async () => {
    if (!documentUrl) return;

    try {
      const { error } = await supabase.storage
        .from('customer-documents')
        .remove([documentUrl]);

      if (error) throw error;

      // Update customer record to remove document URL
      const { error: updateError } = await supabase
        .from('customers')
        .update({ company_registration_document_url: null })
        .eq('id', customerId);

      if (updateError) throw updateError;

      setDocumentUrl(undefined);
      onUpload('');

      toast({
        title: "Success",
        description: "Document removed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Remove failed",
        description: error.message || "Failed to remove document",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      
      {documentUrl ? (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm">Document uploaded</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload Document"}
            </Button>
          </div>
          
          {uploading && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-muted-foreground">{uploadProgress}% uploaded</p>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Accepts PDF, JPG, PNG files up to 10MB
          </p>
        </div>
      )}
    </div>
  );
}