import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileText, Download, Trash2, Upload, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useContractDocuments } from "@/hooks/useContractDocuments";
import { UploadContractDocumentDialog } from "./UploadContractDocumentDialog";
import { format } from "date-fns";
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

interface ContractDocumentsSectionProps {
  contractId: string;
}

export function ContractDocumentsSection({ contractId }: ContractDocumentsSectionProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  
  const { documents, isLoading, deleteDocument, downloadDocument, updateDocumentStatus } = 
    useContractDocuments(contractId);

  const getSignatureStatusIcon = (status: string) => {
    switch (status) {
      case "fully_signed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "unsigned":
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      case "pending":
      case "partially_signed":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const handleDelete = async () => {
    if (deleteDocId) {
      await deleteDocument.mutateAsync(deleteDocId);
      setDeleteDocId(null);
    }
  };

  if (isLoading) {
    return <div>Loading documents...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Contract Documents</h3>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {!documents || documents.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No documents uploaded yet</p>
          <Button variant="outline" className="mt-4" onClick={() => setUploadOpen(true)}>
            Upload First Document
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-medium">{doc.document_name}</span>
                    {doc.is_latest_version && (
                      <Badge variant="secondary">Latest</Badge>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-4">
                      <span>Type: {doc.document_type.replace(/_/g, " ")}</span>
                      <span>Version: {doc.version_number}</span>
                      {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                    </div>
                    <div>
                      Uploaded: {format(new Date(doc.uploaded_at), "PPP")}
                    </div>
                    {doc.description && (
                      <div className="text-xs">{doc.description}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm">Signature Status:</span>
                    <Select
                      value={doc.signature_status}
                      onValueChange={(value) =>
                        updateDocumentStatus.mutate({
                          documentId: doc.id,
                          signatureStatus: value,
                          isSigned: value === "fully_signed",
                        })
                      }
                    >
                      <SelectTrigger className="w-[180px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unsigned">Unsigned</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="partially_signed">Partially Signed</SelectItem>
                        <SelectItem value="fully_signed">Fully Signed</SelectItem>
                      </SelectContent>
                    </Select>
                    {getSignatureStatusIcon(doc.signature_status)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => downloadDocument(doc.file_path, doc.document_name)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteDocId(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <UploadContractDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        contractId={contractId}
      />

      <AlertDialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
