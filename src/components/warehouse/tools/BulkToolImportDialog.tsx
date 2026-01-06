import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useWarehouseTools } from "@/hooks/useWarehouseTools";
import { useItemUnits } from "@/hooks/useItemUnits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface BulkToolImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedTool {
  rowNumber: number;
  tool_code: string;
  name: string;
  description: string;
  category: string;
  location: string;
  unit: string;
  total_quantity: number;
  condition: string;
  unit_cost: number | null;
  notes: string;
  category_id?: string;
  location_id?: string;
  unit_id?: string;
  errors: string[];
  isValid: boolean;
}

const VALID_CONDITIONS = ["good", "fair", "poor", "needs_repair"];

export function BulkToolImportDialog({ open, onOpenChange }: BulkToolImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedTool[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { createBulkTools, isCreatingBulk } = useWarehouseTools();
  const { units = [] } = useItemUnits();

  // Fetch categories and locations for validation
  const { data: categories = [] } = useQuery({
    queryKey: ["asset-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("asset_categories").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["warehouse-locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouse_locations").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  const validTools = parsedData.filter((t) => t.isValid);
  const invalidTools = parsedData.filter((t) => !t.isValid);

  const downloadTemplate = () => {
    const template = [
      ["tool_code", "name", "description", "category", "location", "unit", "total_quantity", "condition", "unit_cost", "notes"],
      ["TL-001", "Hammer", "16oz claw hammer", "Hand Tools", "Main Warehouse", "Pieces", "10", "good", "25.99", "Standard issue"],
      ["", "Drill", "Cordless power drill", "Power Tools", "Workshop", "pcs", "5", "good", "149.99", ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tools Template");
    XLSX.writeFile(wb, "tools_import_template.xlsx");
  };

  const parseFile = async (file: File) => {
    setIsParsing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });

      const parsed: ParsedTool[] = jsonData.map((row, index) => {
        const errors: string[] = [];
        const name = String(row.name || "").trim();
        const toolCode = String(row.tool_code || "").trim();
        const description = String(row.description || "").trim();
        const categoryName = String(row.category || "").trim();
        const locationName = String(row.location || "").trim();
        const unitName = String(row.unit || "").trim();
        const quantityRaw = row.total_quantity;
        const conditionRaw = String(row.condition || "good").trim().toLowerCase();
        const unitCostRaw = row.unit_cost;
        const notes = String(row.notes || "").trim();

        // Validate name (required)
        if (!name) {
          errors.push("Name is required");
        }

        // Validate quantity
        let quantity = 1;
        if (quantityRaw !== "" && quantityRaw !== undefined) {
          const parsed = parseInt(String(quantityRaw), 10);
          if (isNaN(parsed) || parsed <= 0) {
            errors.push("Quantity must be a positive integer");
          } else {
            quantity = parsed;
          }
        }

        // Validate category
        let categoryId: string | undefined;
        if (categoryName) {
          const match = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
          if (!match) {
            errors.push(`Category "${categoryName}" not found`);
          } else {
            categoryId = match.id;
          }
        }

        // Validate location
        let locationId: string | undefined;
        if (locationName) {
          const match = locations.find((l) => l.name.toLowerCase() === locationName.toLowerCase());
          if (!match) {
            errors.push(`Location "${locationName}" not found`);
          } else {
            locationId = match.id;
          }
        }

        // Validate unit
        let unitId: string | undefined;
        if (unitName) {
          const match = units.find(
            (u) =>
              u.name.toLowerCase() === unitName.toLowerCase() ||
              u.abbreviation.toLowerCase() === unitName.toLowerCase()
          );
          if (!match) {
            errors.push(`Unit "${unitName}" not found`);
          } else {
            unitId = match.id;
          }
        }

        // Validate condition
        const condition = VALID_CONDITIONS.includes(conditionRaw) ? conditionRaw : "good";
        if (conditionRaw && !VALID_CONDITIONS.includes(conditionRaw)) {
          errors.push(`Invalid condition "${conditionRaw}". Must be: good, fair, poor, or needs_repair`);
        }

        // Validate unit cost
        let unitCost: number | null = null;
        if (unitCostRaw !== "" && unitCostRaw !== undefined) {
          const parsed = parseFloat(String(unitCostRaw));
          if (isNaN(parsed) || parsed < 0) {
            errors.push("Unit cost must be a valid positive number");
          } else {
            unitCost = parsed;
          }
        }

        return {
          rowNumber: index + 2, // +2 for header row and 0-indexing
          tool_code: toolCode,
          name,
          description,
          category: categoryName,
          location: locationName,
          unit: unitName,
          total_quantity: quantity,
          condition,
          unit_cost: unitCost,
          notes,
          category_id: categoryId,
          location_id: locationId,
          unit_id: unitId,
          errors,
          isValid: errors.length === 0,
        };
      });

      setParsedData(parsed);
    } catch (error) {
      console.error("Error parsing file:", error);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const handleImport = () => {
    const toolsToImport = validTools.map((t) => ({
      tool_code: t.tool_code || "",
      name: t.name,
      description: t.description || undefined,
      category_id: t.category_id,
      location_id: t.location_id,
      unit_id: t.unit_id,
      total_quantity: t.total_quantity,
      condition: t.condition,
      unit_cost: t.unit_cost ?? undefined,
      notes: t.notes || undefined,
    }));

    createBulkTools(toolsToImport, {
      onSuccess: () => {
        onOpenChange(false);
        resetState();
      },
    });
  };

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Import Tools
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to import multiple tools at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">Download Template</p>
              <p className="text-sm text-muted-foreground">
                Use this template to ensure proper formatting
              </p>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload File</label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
            />
          </div>

          {/* Parsing State */}
          {isParsing && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Parsing file...</span>
            </div>
          )}

          {/* Results Summary */}
          {parsedData.length > 0 && !isParsing && (
            <>
              <div className="flex gap-4">
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {validTools.length} Valid
                </Badge>
                {invalidTools.length > 0 && (
                  <Badge variant="outline" className="text-destructive border-destructive">
                    <XCircle className="h-4 w-4 mr-1" />
                    {invalidTools.length} Invalid
                  </Badge>
                )}
              </div>

              {/* Valid Tools Preview */}
              {validTools.length > 0 && (
                <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                  <h4 className="text-sm font-medium text-green-600">Valid Tools</h4>
                  <ScrollArea className="flex-1 border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Condition</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validTools.map((tool) => (
                          <TableRow key={tool.rowNumber}>
                            <TableCell>{tool.rowNumber}</TableCell>
                            <TableCell>{tool.tool_code || "Auto"}</TableCell>
                            <TableCell>{tool.name}</TableCell>
                            <TableCell>{tool.category || "-"}</TableCell>
                            <TableCell>{tool.location || "-"}</TableCell>
                            <TableCell className="text-right">{tool.total_quantity}</TableCell>
                            <TableCell className="capitalize">{tool.condition}</TableCell>
                            <TableCell className="text-right">
                              {tool.unit_cost ? `$${tool.unit_cost.toFixed(2)}` : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              {/* Invalid Tools Preview */}
              {invalidTools.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-destructive">Invalid Tools</h4>
                  <ScrollArea className="max-h-40 border border-destructive/50 rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Errors</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invalidTools.map((tool) => (
                          <TableRow key={tool.rowNumber}>
                            <TableCell>{tool.rowNumber}</TableCell>
                            <TableCell>{tool.name || "(empty)"}</TableCell>
                            <TableCell className="text-destructive">
                              {tool.errors.join("; ")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={validTools.length === 0 || isCreatingBulk}
          >
            {isCreatingBulk ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {validTools.length} Tools
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
