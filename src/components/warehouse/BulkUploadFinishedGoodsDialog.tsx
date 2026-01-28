import { useState } from 'react';
import { Upload, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBulkUploadFinishedGoods, downloadCSVTemplate, BulkUploadResult } from '@/hooks/useBulkUploadFinishedGoods';
import { writeExcelFromJSON } from '@/utils/excelUtils';

interface BulkUploadFinishedGoodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

export function BulkUploadFinishedGoodsDialog({
  open,
  onOpenChange,
  companyId,
}: BulkUploadFinishedGoodsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [uploadMode, setUploadMode] = useState<'skip' | 'update' | 'new-only'>('skip');
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { parseCSV, uploadMutation, progress } = useBulkUploadFinishedGoods(companyId);

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx')) {
      alert('Please upload a CSV or Excel file');
      return;
    }

    setFile(selectedFile);
    setUploadResult(null);

    try {
      const rows = await parseCSV(selectedFile);
      setPreviewData(rows.slice(0, 10)); // Show first 10 rows
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Failed to parse file. Please check the format.');
      setFile(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      const rows = await parseCSV(file);
      const result = await uploadMutation.mutateAsync({ rows, mode: uploadMode });
      setUploadResult(result);
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const handleDownloadErrors = async () => {
    if (!uploadResult || uploadResult.errors.length === 0) return;

    const errorData = uploadResult.errors.map(err => ({
      Row: err.row,
      Field: err.field,
      Error: err.message,
      Value: err.value || '',
    }));

    await writeExcelFromJSON(errorData, 'upload_errors.xlsx');
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData([]);
    setUploadResult(null);
    setUploadMode('skip');
    onOpenChange(false);
  };

  const previewColumns = previewData[0] ? Object.keys(previewData[0]).slice(0, 6) : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Finished Goods</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to import multiple products at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Download Template */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span className="text-sm font-medium">Need a template?</span>
            </div>
            <Button variant="outline" size="sm" onClick={downloadCSVTemplate}>
              Download CSV Template
            </Button>
          </div>

          {/* File Upload Area */}
          {!file && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">
                Drag and drop your CSV file here, or
              </p>
              <Button
                variant="outline"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                Browse Files
              </Button>
              <input
                id="file-input"
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              <p className="text-xs text-muted-foreground mt-4">
                Supports CSV and Excel files (max 10MB)
              </p>
            </div>
          )}

          {/* File Selected */}
          {file && !uploadResult && (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  File selected: <strong>{file.name}</strong> ({previewData.length} rows)
                </AlertDescription>
              </Alert>

              {/* Preview Table */}
              {previewData.length > 0 && (
                <div className="space-y-2">
                  <Label>Preview (first 10 rows)</Label>
                  <ScrollArea className="h-48 border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {previewColumns.map((col) => (
                            <TableHead key={col} className="whitespace-nowrap">
                              {col}
                            </TableHead>
                          ))}
                          <TableHead>...</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row, idx) => (
                          <TableRow key={idx}>
                            {previewColumns.map((col) => (
                              <TableCell key={col} className="whitespace-nowrap">
                                {row[col]?.toString().substring(0, 30) || '-'}
                              </TableCell>
                            ))}
                            <TableCell>...</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              {/* Upload Mode */}
              <div className="space-y-2">
                <Label>What to do with existing product codes?</Label>
                <RadioGroup value={uploadMode} onValueChange={(v: any) => setUploadMode(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="skip" id="skip" />
                    <Label htmlFor="skip" className="font-normal cursor-pointer">
                      Skip duplicates (recommended)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="update" id="update" />
                    <Label htmlFor="update" className="font-normal cursor-pointer">
                      Update existing products
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new-only" id="new-only" />
                    <Label htmlFor="new-only" className="font-normal cursor-pointer">
                      Import only new products
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Progress */}
              {uploadMutation.isPending && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}
            </>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <div className="space-y-4">
              <Alert variant={uploadResult.errors.length > 0 ? 'destructive' : 'default'}>
                {uploadResult.errors.length > 0 ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Upload Summary</p>
                    <ul className="text-sm space-y-1">
                      <li>✓ Success: {uploadResult.success} products</li>
                      {uploadResult.skipped > 0 && (
                        <li>⊘ Skipped: {uploadResult.skipped} products</li>
                      )}
                      {uploadResult.failed > 0 && (
                        <li>✗ Failed: {uploadResult.failed} products</li>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

              {uploadResult.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-destructive">
                      Errors ({uploadResult.errors.length})
                    </Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadErrors}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Error Report
                    </Button>
                  </div>
                  <ScrollArea className="h-32 border rounded-md p-4">
                    <div className="space-y-2 text-sm">
                      {uploadResult.errors.slice(0, 10).map((err, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                          <span>
                            <strong>Row {err.row}:</strong> {err.field} - {err.message}
                            {err.value && ` (value: ${err.value})`}
                          </span>
                        </div>
                      ))}
                      {uploadResult.errors.length > 10 && (
                        <p className="text-muted-foreground">
                          ... and {uploadResult.errors.length - 10} more errors
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!uploadResult && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Upload Products'}
              </Button>
            </>
          )}
          {uploadResult && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setFile(null);
                  setPreviewData([]);
                  setUploadResult(null);
                }}
              >
                Upload Another File
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
