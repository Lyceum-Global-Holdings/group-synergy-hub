import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useContractDocuments, useContractDocumentMutations } from "@/hooks/useContractDocuments";
import { UploadContractDocumentDialog } from "./UploadContractDocumentDialog";
import { Upload, Download, MoreVertical, Trash2, FileCheck, FileX } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface ContractDocumentsSectionProps {
  contractId: string;
}

export function ContractDocumentsSection({ contractId }: ContractDocumentsSectionProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { data: documents, isLoading } = useContractDocuments(contractId);
  const { deleteDocument, updateDocumentStatus } = useContractDocumentMutations();

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("contract-documents")
      .download(filePath);

    if (error) {
      console.error("Download error:", error);
      return;
    }

    const url = window.URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      await deleteDocument.mutateAsync({ id, filePath, contractId });
    }
  };

  const handleMarkAsSigned = async (id: string) => {
    await updateDocumentStatus.mutateAsync({
      id,
      contractId,
      isSigned: true,
      signatureStatus: "fully_signed",
    });
  };

  const getDocumentTypeLabel = (type: string) => {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const getSignatureStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      unsigned: "secondary",
      pending: "outline",
      partially_signed: "default",
      fully_signed: "default",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
      </Badge>
    );
  };

  if (isLoading) {
    return <div>Loading documents...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documents</CardTitle>
          <Button onClick={() => setUploadDialogOpen(true)} size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </CardHeader>
        <CardContent>
          {!documents || documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No documents uploaded yet. Click "Upload Document" to add files.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Signature Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.document_name}</TableCell>
                    <TableCell>{getDocumentTypeLabel(doc.document_type)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.version_number}</Badge>
                    </TableCell>
                    <TableCell>{getSignatureStatusBadge(doc.signature_status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(doc.uploaded_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDownload(doc.file_path, doc.document_name)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          {!doc.is_signed && (
                            <DropdownMenuItem onClick={() => handleMarkAsSigned(doc.id)}>
                              <FileCheck className="h-4 w-4 mr-2" />
                              Mark as Signed
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(doc.id, doc.file_path)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UploadContractDocumentDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        contractId={contractId}
      />
    </>
  );
}
