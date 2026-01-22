import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { readExcelFile, writeExcelFromAOA } from "@/utils/excelUtils";
import { useBulkCreateItemMaster } from "@/hooks/construction/useConstructionInventory";
import {
  type ItemCategory,
  type ItemSection,
  ITEM_CATEGORIES,
  ITEM_SECTIONS,
} from "@/types/construction-inventory";
import { useToast } from "@/hooks/use-toast";

interface ParsedItem {
  item_code: string;
  item_name: string;
  section: ItemSection;
  brand?: string;
  model?: string;
  unit_of_measurement?: string;
  description?: string;
  unit_cost?: number;
  is_valid: boolean;
  errors: string[];
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ItemCategory;
}

export function BulkImportDialog({ open, onOpenChange, category }: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const bulkCreate = useBulkCreateItemMaster();

  const categoryLabel = ITEM_CATEGORIES.find(c => c.value === category)?.label || "Items";
  const isMachineCategory = category === "machines";

  const handleDownloadTemplate = async () => {
    const headers = [
      "item_code",
      "item_name",
      "section",
      "brand",
      "model",
      "unit_of_measurement",
      "description",
      "unit_cost",
    ];

    const sampleRow = [
      `${category.toUpperCase().slice(0, 3)}-001`,
      `Sample ${categoryLabel.slice(0, -1)}`,
      "civil",
      "Brand Name",
      "Model XYZ",
      "pcs",
      "Sample description",
      "1000",
    ];

    const data = [headers, sampleRow];

    await writeExcelFromAOA(data, `${category}_import_template.xlsx`, categoryLabel);
    toast({ title: "Template downloaded" });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validExtensions = [".csv", ".xlsx", ".xls"];
    const extension = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();

    if (!validExtensions.includes(extension)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setImportResult(null);
    await parseFile(selectedFile);
  };

  const parseFile = async (file: File) => {
    setIsParsing(true);
    try {
      const jsonData = await readExcelFile(file);

      const validSections = ITEM_SECTIONS.map(s => s.value);

      const parsed: ParsedItem[] = jsonData.map((row) => {
        const errors: string[] = [];

        const item_code = String(row.item_code || "").trim();
        const item_name = String(row.item_name || "").trim();
        const section = String(row.section || "").trim().toLowerCase() as ItemSection;
        const brand = String(row.brand || "").trim() || undefined;
        const model = String(row.model || "").trim() || undefined;
        const unit_of_measurement = String(row.unit_of_measurement || "pcs").trim();
        const description = String(row.description || "").trim() || undefined;
        const unit_cost = row.unit_cost ? Number(row.unit_cost) : undefined;

        if (!item_code) errors.push("Missing item code");
        if (!item_name) errors.push("Missing item name");
        if (!validSections.includes(section as ItemSection)) {
          errors.push(`Invalid section: ${section}. Use: ${validSections.join(", ")}`);
        }

        return {
          item_code,
          item_name,
          section: validSections.includes(section as ItemSection) ? section : ("civil" as ItemSection),
          brand,
          model,
          unit_of_measurement,
          description,
          unit_cost: isNaN(unit_cost!) ? undefined : unit_cost,
          is_valid: errors.length === 0,
          errors,
        };
      });

      setParsedItems(parsed);
    } catch (error: any) {
      toast({
        title: "Failed to parse file",
        description: error.message,
        variant: "destructive",
      });
      setParsedItems([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    const validItems = parsedItems.filter(item => item.is_valid);

    if (validItems.length === 0) {
      toast({
        title: "No valid items",
        description: "Please fix the errors and try again",
        variant: "destructive",
      });
      return;
    }

    try {
      await bulkCreate.mutateAsync({
        items: validItems.map(item => ({
          item_code: item.item_code,
          item_name: item.item_name,
          category,
          section: item.section,
          brand: item.brand,
          model: item.model,
          unit_of_measurement: item.unit_of_measurement,
          description: item.description,
          unit_cost: item.unit_cost,
          is_serial_tracked: isMachineCategory,
        })),
      });

      setImportResult({
        success: validItems.length,
        failed: parsedItems.length - validItems.length,
      });
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedItems([]);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const validCount = parsedItems.filter(i => i.is_valid).length;
  const invalidCount = parsedItems.filter(i => !i.is_valid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import {categoryLabel} from File</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Template Download */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Download the template, fill in your data, and upload to import.</span>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </AlertDescription>
          </Alert>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload File (CSV or Excel)</label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
            />
            {file && (
              <p className="text-sm text-muted-foreground">Selected: {file.name}</p>
            )}
          </div>

          {/* Parsing State */}
          {isParsing && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Parsing file...</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedItems.length > 0 && !isParsing && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-100">
                  {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive">
                    {invalidCount} with errors
                  </Badge>
                )}
              </div>

              <ScrollArea className="flex-1 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Brand / Model</TableHead>
                      <TableHead>Unit Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedItems.map((item, index) => (
                      <TableRow key={index} className={!item.is_valid ? "bg-destructive/10" : ""}>
                        <TableCell>
                          {item.is_valid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono">{item.item_code}</TableCell>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.section}</Badge>
                        </TableCell>
                        <TableCell>
                          {item.brand || item.model
                            ? `${item.brand || ""} ${item.model || ""}`.trim()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {item.unit_cost ? `₹${item.unit_cost.toLocaleString()}` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Errors Summary */}
              {invalidCount > 0 && (
                <div className="mt-2">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {invalidCount} row(s) have errors and will be skipped.
                      {parsedItems
                        .filter(i => !i.is_valid)
                        .slice(0, 3)
                        .map((item, i) => (
                          <div key={i} className="text-xs mt-1">
                            Row {parsedItems.indexOf(item) + 1}: {item.errors.join(", ")}
                          </div>
                        ))}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/50">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-100">
                Successfully imported {importResult.success} item(s).
                {importResult.failed > 0 && ` ${importResult.failed} row(s) were skipped due to errors.`}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={handleClose}>
              {importResult ? "Close" : "Cancel"}
            </Button>
            {parsedItems.length > 0 && !importResult && (
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || bulkCreate.isPending}
              >
                {bulkCreate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {validCount} Item(s)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
