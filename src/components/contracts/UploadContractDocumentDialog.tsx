import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContractDocumentMutations } from "@/hooks/useContractDocuments";
import { Upload, X } from "lucide-react";

interface UploadContractDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
}

export function UploadContractDocumentDialog({
  open,
  onOpenChange,
  contractId,
}: UploadContractDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("main_contract");
  const [versionNumber, setVersionNumber] = useState("1.0");
  const [description, setDescription] = useState("");

  const { uploadDocument } = useContractDocumentMutations();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!documentName) {
        setDocumentName(selectedFile.name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    await uploadDocument.mutateAsync({
      contractId,
      file,
      documentType,
      documentName,
      description,
      versionNumber,
    });

    // Reset form
    setFile(null);
    setDocumentName("");
    setDocumentType("main_contract");
    setVersionNumber("1.0");
    setDescription("");
    onOpenChange(false);
  };

  const removeFile = () => {
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Contract Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <div className="flex items-center gap-2">
              {!file ? (
                <div className="flex-1">
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
                    required
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-between p-3 border rounded-md bg-muted">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="documentName">Document Name</Label>
            <Input
              id="documentName"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Enter document name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="documentType">Document Type</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger id="documentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main_contract">Main Contract</SelectItem>
                <SelectItem value="amendment">Amendment</SelectItem>
                <SelectItem value="annex">Annex</SelectItem>
                <SelectItem value="supporting_document">Supporting Document</SelectItem>
                <SelectItem value="signed_copy">Signed Copy</SelectItem>
                <SelectItem value="scan">Scan</SelectItem>
                <SelectItem value="certificate">Certificate</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="compliance_document">Compliance Document</SelectItem>
                <SelectItem value="correspondence">Correspondence</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="versionNumber">Version Number</Label>
            <Input
              id="versionNumber"
              value={versionNumber}
              onChange={(e) => setVersionNumber(e.target.value)}
              placeholder="e.g., 1.0, 2.1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter document description (optional)"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!file || uploadDocument.isPending}>
              {uploadDocument.isPending ? "Uploading..." : "Upload Document"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
