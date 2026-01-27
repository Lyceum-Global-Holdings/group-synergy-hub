import { useState, useCallback, useEffect } from "react";
import { Upload, Download, FileSpreadsheet, AlertCircle, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { readExcelFile, writeExcelFromAOA } from "@/utils/excelUtils";
import { useBulkCreateLabourMaster, useLabourMaster } from "@/hooks/construction/useLabourMaster";

interface ParsedLabour {
  employee_id: string;
  name: string;
  epf_no: string;
  trade: string;
  category: string;
  labour_company: string;
  skill_level: string;
  contact_number: string;
  email: string;
  hourly_rate: number | null;
  daily_rate: number | null;
  status: string;
  notes: string;
  is_valid: boolean;
  errors: string[];
}

const VALID_STATUSES = ["active", "inactive"];
const VALID_SKILL_LEVELS = ["unskilled", "semi_skilled", "skilled", "master"];
const VALID_CATEGORIES = [
  "Civil Skill",
  "MEP Skill",
  "Aluminium Skill",
  "Mechanical Skill",
  "Carpenter",
  "General",
];

interface LabourBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LabourBulkImportDialog({
  open,
  onOpenChange,
}: LabourBulkImportDialogProps) {
  const { toast } = useToast();
  const [parsedItems, setParsedItems] = useState<ParsedLabour[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const bulkCreateMutation = useBulkCreateLabourMaster();
  const { data: existingLabour = [] } = useLabourMaster();

  // Calculate the next starting Employee ID based on existing records
  const getNextEmployeeIdStart = useCallback(() => {
    const existingIds = existingLabour
      .map((l) => l.employee_id)
      .filter((id): id is string => !!id && id.startsWith("EMP"))
      .map((id) => parseInt(id.substring(3), 10))
      .filter((num) => !isNaN(num));
    
    return existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
  }, [existingLabour]);

  // Auto-assign Employee IDs when items are parsed
  useEffect(() => {
    if (parsedItems.length > 0) {
      const startIndex = getNextEmployeeIdStart();
      setParsedItems((prev) =>
        prev.map((item, index) => ({
          ...item,
          employee_id: `EMP${String(startIndex + index).padStart(5, "0")}`,
        }))
      );
    }
  }, [existingLabour.length]); // Only re-run when existing data changes

  const revalidateItem = useCallback((item: ParsedLabour): ParsedLabour => {
    const errors: string[] = [];
    
    if (!item.name?.trim()) errors.push("Missing name");
    if (item.status && !VALID_STATUSES.includes(item.status.toLowerCase())) {
      errors.push(`Invalid status: ${item.status}`);
    }
    if (item.skill_level && !VALID_SKILL_LEVELS.includes(item.skill_level.toLowerCase().replace(" ", "_"))) {
      errors.push(`Invalid skill level: ${item.skill_level}`);
    }
    
    return {
      ...item,
      is_valid: errors.length === 0,
      errors,
    };
  }, []);

  const updateItemField = useCallback((index: number, field: keyof ParsedLabour, value: any) => {
    setParsedItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      updated[index] = revalidateItem(updated[index]);
      return updated;
    });
  }, [revalidateItem]);

  const handleDownloadTemplate = async () => {
    // Remove employee_id from template - it will be auto-generated
    const headers = [
      "name",
      "epf_no",
      "trade",
      "category",
      "labour_company",
      "skill_level",
      "contact_number",
      "email",
      "hourly_rate",
      "daily_rate",
      "status",
      "notes",
    ];

    const sampleRow = [
      "John Doe",
      "EPF12345",
      "Mason",
      "Civil Skill",
      "ABC Contractors",
      "skilled",
      "+94771234567",
      "john@example.com",
      "250",
      "2000",
      "active",
      "Experienced mason",
    ];

    const data = [
      headers,
      sampleRow,
      [],
      ["# Notes:"],
      ["# Employee ID will be auto-generated (e.g., EMP00001, EMP00002, ...)"],
      ["# category: Civil Skill, MEP Skill, Aluminium Skill, Mechanical Skill, Carpenter, General"],
      ["# skill_level: unskilled, semi_skilled, skilled, master"],
      ["# status: active, inactive"],
    ];

    await writeExcelFromAOA(data, "labour_import_template.xlsx", "Labour Import");
    toast({ title: "Template downloaded" });
  };

  const parseFile = async (file: File) => {
    setIsParsing(true);
    try {
      const jsonData = await readExcelFile(file);
      const startIndex = getNextEmployeeIdStart();

      const parsed: ParsedLabour[] = jsonData
        .filter((row) => {
          const firstCell = String(row.name || "").trim();
          return firstCell && !firstCell.startsWith("#");
        })
        .map((row, index) => {
          const errors: string[] = [];

          const name = String(row.name || "").trim();
          // Auto-generate Employee ID sequentially
          const employee_id = `EMP${String(startIndex + index).padStart(5, "0")}`;
          const epf_no = String(row.epf_no || "").trim();
          const trade = String(row.trade || "").trim();
          const category = String(row.category || "").trim();
          const labour_company = String(row.labour_company || "").trim();
          const skill_level = String(row.skill_level || "").trim().toLowerCase().replace(" ", "_");
          const contact_number = String(row.contact_number || "").trim();
          const email = String(row.email || "").trim();
          const status = String(row.status || "active").trim().toLowerCase();
          const notes = String(row.notes || "").trim();

          // Parse numeric values
          const hourly_rate = row.hourly_rate ? parseFloat(String(row.hourly_rate)) : null;
          const daily_rate = row.daily_rate ? parseFloat(String(row.daily_rate)) : null;

          // Validation
          if (!name) errors.push("Missing name");
          if (status && !VALID_STATUSES.includes(status)) {
            errors.push(`Invalid status: ${status}`);
          }
          if (skill_level && !VALID_SKILL_LEVELS.includes(skill_level)) {
            errors.push(`Invalid skill level: ${skill_level}`);
          }

          return {
            employee_id,
            name,
            epf_no,
            trade,
            category,
            labour_company,
            skill_level,
            contact_number,
            email,
            hourly_rate: isNaN(hourly_rate!) ? null : hourly_rate,
            daily_rate: isNaN(daily_rate!) ? null : daily_rate,
            status: status || "active",
            notes,
            is_valid: errors.length === 0,
            errors,
          };
        });

      setParsedItems(parsed);
      setFileName(file.name);

      const validCount = parsed.filter((p) => p.is_valid).length;
      toast({
        title: `Parsed ${parsed.length} rows`,
        description: `${validCount} valid, ${parsed.length - validCount} with errors`,
      });
    } catch (error) {
      console.error("Parse error:", error);
      toast({
        title: "Failed to parse file",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const handleImport = async () => {
    const validItems = parsedItems.filter((item) => item.is_valid);
    if (validItems.length === 0) {
      toast({
        title: "No valid items to import",
        description: "Please fix the errors before importing",
        variant: "destructive",
      });
      return;
    }

    try {
      await bulkCreateMutation.mutateAsync(
        validItems.map((item) => ({
          employee_id: item.employee_id || null,
          name: item.name,
          epf_no: item.epf_no || null,
          trade: item.trade || null,
          category: item.category || null,
          labour_company: item.labour_company || null,
          skill_level: item.skill_level || null,
          contact_number: item.contact_number || null,
          email: item.email || null,
          hourly_rate: item.hourly_rate,
          daily_rate: item.daily_rate,
          status: item.status || "active",
          notes: item.notes || null,
        }))
      );

      toast({
        title: "Import successful",
        description: `Imported ${validItems.length} labour records`,
      });
      
      setParsedItems([]);
      setFileName(null);
      onOpenChange(false);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setParsedItems([]);
    setFileName(null);
    onOpenChange(false);
  };

  const validCount = parsedItems.filter((p) => p.is_valid).length;
  const invalidCount = parsedItems.length - validCount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Import Labour Records
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to import multiple labour records at once
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Upload Section */}
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <div className="relative">
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={isParsing}
              />
              <Button variant="outline" disabled={isParsing}>
                <Upload className="mr-2 h-4 w-4" />
                {isParsing ? "Parsing..." : "Upload File"}
              </Button>
            </div>
            {fileName && (
              <span className="text-sm text-muted-foreground">
                {fileName}
              </span>
            )}
          </div>

          {/* Summary */}
          {parsedItems.length > 0 && (
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="gap-1">
                Total: {parsedItems.length}
              </Badge>
              <Badge variant="default" className="gap-1">
                <Check className="h-3 w-3" />
                Valid: {validCount}
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <X className="h-3 w-3" />
                  Errors: {invalidCount}
                </Badge>
              )}
            </div>
          )}

          {/* Preview Table */}
          {parsedItems.length > 0 && (
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name *</TableHead>
                    <TableHead>EPF No</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Work Status</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedItems.map((item, index) => (
                    <TableRow
                      key={index}
                      className={!item.is_valid ? "bg-destructive/10" : ""}
                    >
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        {item.is_valid ? (
                          <Badge variant="outline" className="text-primary border-primary">
                            <Check className="h-3 w-3 mr-1" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.employee_id}
                          disabled
                          className="h-8 w-28 bg-muted text-muted-foreground"
                          title="Auto-generated"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.name}
                          onChange={(e) => updateItemField(index, "name", e.target.value)}
                          className={`h-8 w-32 ${!item.name ? "border-destructive" : ""}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.epf_no}
                          onChange={(e) => updateItemField(index, "epf_no", e.target.value)}
                          className="h-8 w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.category}
                          onValueChange={(value) => updateItemField(index, "category", value)}
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {VALID_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.labour_company}
                          onChange={(e) => updateItemField(index, "labour_company", e.target.value)}
                          className="h-8 w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.contact_number}
                          onChange={(e) => updateItemField(index, "contact_number", e.target.value)}
                          className="h-8 w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.status}
                          onValueChange={(value) => updateItemField(index, "status", value)}
                        >
                          <SelectTrigger className="h-8 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {item.errors.length > 0 && (
                          <span className="text-xs text-destructive">
                            {item.errors.join(", ")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Empty State */}
          {parsedItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mb-4 opacity-50" />
              <p>Upload a CSV or Excel file to preview data</p>
              <p className="text-sm">Download the template for the correct format</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={validCount === 0 || bulkCreateMutation.isPending}
          >
            {bulkCreateMutation.isPending ? "Importing..." : `Import ${validCount} Records`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
