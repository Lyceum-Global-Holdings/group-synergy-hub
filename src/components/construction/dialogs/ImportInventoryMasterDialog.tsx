import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBulkCreateInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { readExcelFile } from "@/utils/excelUtils";
import type { CreateInventoryMasterData } from "@/types/construction";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Predefined Section values
const INVENTORY_SECTIONS = [
  { value: "civil", label: "Civil" },
  { value: "mechanical", label: "Mechanical" },
  { value: "carpenter", label: "Carpenter" },
  { value: "mep", label: "MEP" },
  { value: "aluminium", label: "Aluminium" },
];

// Predefined Category values
const INVENTORY_CATEGORIES = [
  { value: "machines", label: "Machines" },
  { value: "tools", label: "Tools" },
  { value: "equipments", label: "Equipments" },
  { value: "scaffolding", label: "Scaffolding" },
  { value: "materials", label: "Materials" },
  { value: "safety", label: "Safety" },
];

interface ImportInventoryMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedItem {
  item_code: string;
  item_name: string;
  description: string;
  unit: string;
  quantity: number;
}

export function ImportInventoryMasterDialog({ open, onOpenChange }: ImportInventoryMasterDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
  const [section, setSection] = useState("civil");
  const [category, setCategory] = useState("machines");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const bulkCreateMutation = useBulkCreateInventoryMaster();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv"
    ];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel (.xlsx) or CSV file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const data = await readExcelFile(file);
      
      if (!data || data.length === 0) {
        toast({
          title: "No data found",
          description: "The file appears to be empty",
          variant: "destructive",
        });
        return;
      }

      // Parse the Excel data
      const items: ParsedItem[] = data.map((row: Record<string, any>) => {
        // Try to map common column names
        const itemCode = row.machine_id || row.item_code || row.code || row.id || '';
        const itemName = row.machine_name || row.item_name || row.name || '';
        const description = row.serial_or_ref || row.description || row.serial || '';
        const unit = row.unit || 'Nos';
        const quantity = Number(row.qty || row.quantity || 1) || 1;

        return {
          item_code: String(itemCode).trim(),
          item_name: String(itemName).trim(),
          description: String(description).trim(),
          unit: String(unit).trim(),
          quantity,
        };
      }).filter(item => item.item_name); // Filter out rows without item name

      if (items.length === 0) {
        toast({
          title: "No valid data found",
          description: "Could not find items with valid names in the file",
          variant: "destructive",
        });
        return;
      }

      setParsedData(items);
      setStep('preview');
    } catch (error: any) {
      toast({
        title: "Error reading file",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    const itemsToImport: CreateInventoryMasterData[] = parsedData.map(item => ({
      item_code: item.item_code || undefined,
      item_name: item.item_name,
      section,
      category,
      unit: item.unit,
      quantity: item.quantity,
      description: item.description || undefined,
      status: 'active',
    }));

    try {
      await bulkCreateMutation.mutateAsync(itemsToImport);
      handleClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    setStep('upload');
    setParsedData([]);
    setSection("civil");
    setCategory("machines");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Inventory Items</DialogTitle>
          <DialogDescription>
            Upload an Excel file to import multiple items at once
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6 py-4">
            {/* Section and Category Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Section</Label>
                <Select value={section} onValueChange={setSection}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_SECTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* File Upload */}
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  <span className="text-muted-foreground">Reading file...</span>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Click to upload Excel file</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports .xlsx, .xls, .csv files
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
            />

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Expected columns: machine_id/item_code, machine_name/item_name, serial_or_ref/description, unit, qty/quantity
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                <span className="font-medium">{parsedData.length} items found</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Section: <span className="font-medium">{INVENTORY_SECTIONS.find(s => s.value === section)?.label}</span>
                {" | "}
                Category: <span className="font-medium">{INVENTORY_CATEGORIES.find(c => c.value === category)?.label}</span>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item ID</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{item.item_code || '-'}</TableCell>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {item.description || '-'}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={bulkCreateMutation.isPending}>
                {bulkCreateMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import {parsedData.length} Items
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
