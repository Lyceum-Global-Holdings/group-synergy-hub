import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Download, X } from "lucide-react";

interface InvoiceUploadFieldProps {
  grnId?: string;
  currentDocumentUrl?: string;
  onUpload: (url: string) => void;
  label?: string;
}

export function InvoiceUploadField({ 
  grnId, 
  currentDocumentUrl, 
  onUpload,
  label = "Invoice Document"
}: InvoiceUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [documentUrl, setDocumentUrl] = useState(currentDocumentUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or image file (JPG, PNG)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 3MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);

      const fileName = grnId 
        ? `${grnId}/invoice_${Date.now()}_${file.name}`
        : `temp/invoice_${Date.now()}_${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('grn-invoices')
        .upload(fileName, file);

      if (error) throw error;

      setDocumentUrl(data.path);
      onUpload(data.path);

      if (grnId) {
        const { error: updateError } = await supabase
          .from('goods_receipt_notes')
          .update({ invoice_document_url: data.path })
          .eq('id', grnId);

        if (updateError) throw updateError;
      }

      toast({
        title: "Success",
        description: "Invoice uploaded successfully",
      });
    } catch (error: any) {
      console.error('Error uploading invoice:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload invoice",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async () => {
    if (!documentUrl) return;

    try {
      const { data, error } = await supabase.storage
        .from('grn-invoices')
        .download(documentUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message || "Failed to download invoice",
        variant: "destructive",
      });
    }
  };

  const handleRemove = async () => {
    if (!documentUrl) return;

    try {
      const { error } = await supabase.storage
        .from('grn-invoices')
        .remove([documentUrl]);

      if (error) throw error;

      if (grnId) {
        const { error: updateError } = await supabase
          .from('goods_receipt_notes')
          .update({ invoice_document_url: null })
          .eq('id', grnId);

        if (updateError) throw updateError;
      }

      setDocumentUrl(undefined);
      onUpload('');

      toast({
        title: "Success",
        description: "Invoice removed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Remove failed",
        description: error.message || "Failed to remove invoice",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {documentUrl ? (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm truncate">Invoice uploaded</span>
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
            className="w-full flex items-center justify-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload Invoice"}
          </Button>
          
          <p className="text-xs text-muted-foreground">
            PDF, JPG, PNG • Max 3MB
          </p>
        </div>
      )}
    </div>
  );
}
