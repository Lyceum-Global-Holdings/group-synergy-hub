import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload } from "lucide-react";
import { useContractDocuments } from "@/hooks/useContractDocuments";

interface UploadContractDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
}

const DOCUMENT_TYPES = [
  { value: "main_contract", label: "Main Contract" },
  { value: "amendment", label: "Amendment" },
  { value: "annex", label: "Annex" },
  { value: "supporting_document", label: "Supporting Document" },
  { value: "signed_copy", label: "Signed Copy" },
  { value: "scan", label: "Scan" },
  { value: "certificate", label: "Certificate" },
  { value: "insurance", label: "Insurance Document" },
  { value: "compliance_document", label: "Compliance Document" },
  { value: "correspondence", label: "Correspondence" },
  { value: "other", label: "Other" },
];

export function UploadContractDocumentDialog({
  open,
  onOpenChange,
  contractId,
}: UploadContractDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("");
  const [versionNumber, setVersionNumber] = useState<string>("1.0");
  const [description, setDescription] = useState<string>("");

  const { uploadDocument } = useContractDocuments(contractId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !documentType) {
      return;
    }

    await uploadDocument.mutateAsync({
      file,
      documentType,
      description,
      versionNumber,
    });

    setFile(null);
    setDocumentType("");
    setVersionNumber("1.0");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Contract Document</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">File *</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Max 50MB. Accepted: PDF, Word, Excel, Images, Text
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="documentType">Document Type *</Label>
            <Select value={documentType} onValueChange={setDocumentType} required>
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="versionNumber">Version Number</Label>
            <Input
              id="versionNumber"
              value={versionNumber}
              onChange={(e) => setVersionNumber(e.target.value)}
              placeholder="1.0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this document"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploadDocument.isPending}>
              <Upload className="mr-2 h-4 w-4" />
              {uploadDocument.isPending ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
