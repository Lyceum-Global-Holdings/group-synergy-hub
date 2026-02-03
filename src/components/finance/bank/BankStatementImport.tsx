import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle } from "lucide-react";
import { useBankStatementImport } from "@/hooks/finance/useBankStatementImport";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccountId: string;
  onImportComplete?: () => void;
}

export function BankStatementImport({ open, onOpenChange, bankAccountId, onImportComplete }: Props) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  
  const {
    headers,
    columnMapping,
    parsedLines,
    fileName,
    isImporting,
    processFile,
    setColumnMapping,
    applyMapping,
    importStatement,
    reset,
  } = useBankStatementImport(bankAccountId);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      processFile(file);
      setStep('mapping');
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
      setStep('mapping');
    }
  }, [processFile]);

  const handleApplyMapping = () => {
    applyMapping();
    setStep('preview');
  };

  const handleImport = () => {
    importStatement(undefined, {
      onSuccess: () => {
        onOpenChange(false);
        reset();
        setStep('upload');
        onImportComplete?.();
      },
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
    setStep('upload');
  };

  const totalDebits = parsedLines.reduce((sum, l) => sum + (l.debit_amount || 0), 0);
  const totalCredits = parsedLines.reduce((sum, l) => sum + (l.credit_amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Bank Statement
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file containing your bank transactions'}
            {step === 'mapping' && 'Map the columns from your file to the required fields'}
            {step === 'preview' && `Review ${parsedLines.length} transactions before importing`}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {['upload', 'mapping', 'preview'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                step === s ? "bg-primary text-primary-foreground" : 
                ['upload', 'mapping', 'preview'].indexOf(step) > i ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
              )}>
                {['upload', 'mapping', 'preview'].indexOf(step) > i ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < 2 && <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {/* Upload Step */}
          {step === 'upload' && (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Drop your CSV file here</h3>
              <p className="text-muted-foreground mb-4">or click to browse</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <Button asChild>
                <label htmlFor="csv-upload" className="cursor-pointer">
                  Select File
                </label>
              </Button>
            </div>
          )}

          {/* Mapping Step */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>File:</strong> {fileName} • <strong>Columns detected:</strong> {headers.length}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date Column *</Label>
                  <Select 
                    value={columnMapping.date} 
                    onValueChange={(v) => setColumnMapping({ ...columnMapping, date: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Description Column *</Label>
                  <Select 
                    value={columnMapping.description} 
                    onValueChange={(v) => setColumnMapping({ ...columnMapping, description: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Debit/Withdrawal Column</Label>
                  <Select 
                    value={columnMapping.debit} 
                    onValueChange={(v) => setColumnMapping({ ...columnMapping, debit: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Credit/Deposit Column</Label>
                  <Select 
                    value={columnMapping.credit} 
                    onValueChange={(v) => setColumnMapping({ ...columnMapping, credit: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Reference Column</Label>
                  <Select 
                    value={columnMapping.reference || ''} 
                    onValueChange={(v) => setColumnMapping({ ...columnMapping, reference: v || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Balance Column</Label>
                  <Select 
                    value={columnMapping.balance || ''} 
                    onValueChange={(v) => setColumnMapping({ ...columnMapping, balance: v || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-4">
              {parsedLines.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
                  <p className="text-muted-foreground">No valid transactions found. Please check your column mapping.</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-4">
                    <Badge variant="outline" className="py-1 px-3">
                      {parsedLines.length} Transactions
                    </Badge>
                    <Badge variant="outline" className="py-1 px-3 text-red-600">
                      Total Debits: {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Badge>
                    <Badge variant="outline" className="py-1 px-3 text-green-600">
                      Total Credits: {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedLines.slice(0, 50).map((line) => (
                          <TableRow key={line.line_number}>
                            <TableCell className="text-muted-foreground">{line.line_number}</TableCell>
                            <TableCell>{line.transaction_date}</TableCell>
                            <TableCell>{line.reference || '-'}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{line.description}</TableCell>
                            <TableCell className="text-right text-red-600">
                              {line.debit_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '-'}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {line.credit_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {parsedLines.length > 50 && (
                    <p className="text-sm text-muted-foreground text-center">
                      Showing first 50 of {parsedLines.length} transactions
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}
          
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => { reset(); setStep('upload'); }}>Back</Button>
              <Button onClick={handleApplyMapping} disabled={!columnMapping.date || !columnMapping.description}>
                Continue
              </Button>
            </>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
              <Button onClick={handleImport} disabled={isImporting || parsedLines.length === 0}>
                {isImporting ? "Importing..." : `Import ${parsedLines.length} Transactions`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
