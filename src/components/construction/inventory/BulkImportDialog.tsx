import { useState, useRef, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Hash,
  Pencil,
} from "lucide-react";
import { readExcelFile, writeExcelFromAOA } from "@/utils/excelUtils";
import { useBulkCreateItemMasterWithSerials, useBulkCreateItemMasterWithStock, useLocations } from "@/hooks/construction/useConstructionInventory";
import {
  type ItemCategory,
  type ItemSection,
  type SerialCondition,
  type SerialAvailability,
  ITEM_CATEGORIES,
  ITEM_SECTIONS,
  SERIAL_CONDITIONS,
  SERIAL_AVAILABILITIES,
} from "@/types/construction-inventory";
import { useToast } from "@/hooks/use-toast";

// Bulk categories - these are quantity-tracked, not serial-tracked
const BULK_CATEGORIES: ItemCategory[] = ['tools', 'safety', 'equipment', 'scaffolding'];

interface ParsedItem {
  item_code: string;
  item_name: string;
  section: ItemSection;
  brand?: string;
  model?: string;
  unit_of_measurement?: string;
  description?: string;
  unit_cost?: number;
  // Serial number fields (for machines)
  serial_number?: string;
  condition?: SerialCondition;
  availability?: SerialAvailability;
  warranty_expiry?: string;
  asset_value?: number;
  // Bulk item fields (for tools, safety, equipment, scaffolding)
  initial_quantity?: number;
  location_name?: string;
  location_id?: string;
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const bulkCreateWithSerials = useBulkCreateItemMasterWithSerials();
  const bulkCreateWithStock = useBulkCreateItemMasterWithStock();
  const { data: locations } = useLocations();

  const categoryLabel = ITEM_CATEGORIES.find(c => c.value === category)?.label || "Items";
  const isMachineCategory = category === "machines";
  const isBulkCategory = BULK_CATEGORIES.includes(category);

  const validSections = ITEM_SECTIONS.map(s => s.value);
  const validConditions = SERIAL_CONDITIONS.map(c => c.value);
  const validAvailabilities = SERIAL_AVAILABILITIES.map(a => a.value);

  // Create location name to ID map
  const locationNameMap = locations?.reduce((acc, loc) => {
    acc[loc.name.toLowerCase()] = loc.id;
    return acc;
  }, {} as Record<string, string>) || {};

  // Revalidate a single item
  const revalidateItem = useCallback((item: ParsedItem): ParsedItem => {
    const errors: string[] = [];
    
    if (!item.item_code) errors.push("Missing item code");
    if (!item.item_name) errors.push("Missing item name");
    if (!validSections.includes(item.section)) {
      errors.push(`Invalid section: ${item.section}`);
    }
    
    if (isMachineCategory) {
      if (!item.serial_number) errors.push("Missing serial number");
      if (item.condition && !validConditions.includes(item.condition)) {
        errors.push(`Invalid condition: ${item.condition}`);
      }
      if (item.availability && !validAvailabilities.includes(item.availability)) {
        errors.push(`Invalid availability: ${item.availability}`);
      }
    }

    // For bulk categories, validate location if quantity is provided
    if (isBulkCategory && item.initial_quantity && item.initial_quantity > 0) {
      if (item.location_name && !item.location_id) {
        errors.push(`Unknown location: ${item.location_name}`);
      }
    }
    
    return {
      ...item,
      is_valid: errors.length === 0,
      errors,
    };
  }, [isMachineCategory, isBulkCategory, validSections, validConditions, validAvailabilities]);

  // Update item field and revalidate
  const updateItemField = useCallback((index: number, field: keyof ParsedItem, value: any) => {
    setParsedItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // If updating location_name for bulk items, also update location_id
      if (field === 'location_name' && isBulkCategory) {
        const locationId = locationNameMap[String(value).toLowerCase()];
        updated[index].location_id = locationId;
      }
      
      updated[index] = revalidateItem(updated[index]);
      return updated;
    });
  }, [revalidateItem, isBulkCategory, locationNameMap]);

  const handleDownloadTemplate = async () => {
    // Base headers for all categories
    const baseHeaders = [
      "item_code",
      "item_name",
      "section",
      "brand",
      "model",
      "unit_of_measurement",
      "description",
      "unit_cost",
    ];

    // Additional headers for machines (serial tracking)
    const machineHeaders = [
      "serial_number",
      "condition",
      "availability",
      "warranty_expiry",
      "asset_value",
    ];

    // Additional headers for bulk categories (quantity tracking)
    const bulkHeaders = [
      "initial_quantity",
      "location_name",
    ];

    let headers: string[];
    let sampleRow: (string | number)[];
    let notes: string[][];

    if (isMachineCategory) {
      headers = [...baseHeaders, ...machineHeaders];
      sampleRow = [
        `${category.toUpperCase().slice(0, 3)}-001`,
        `Sample ${categoryLabel.slice(0, -1)}`,
        "civil",
        "Brand Name",
        "Model XYZ",
        "pcs",
        "Sample description",
        "1000",
        "SN-001",
        "working",
        "available",
        "2026-12-31",
        "50000",
      ];
      notes = [
        [],
        ["# Notes:"],
        ["# section: civil, mep, aluminium, mechanical, carpenter"],
        ["# condition: working, under_repair, damaged, scrap"],
        ["# availability: available, in_use, in_transit, reserved"],
      ];
    } else {
      headers = [...baseHeaders, ...bulkHeaders];
      sampleRow = [
        `${category.toUpperCase().slice(0, 3)}-001`,
        `Sample ${categoryLabel.slice(0, -1)}`,
        "civil",
        "Brand Name",
        "Model XYZ",
        "pcs",
        "Sample description",
        "250",
        "10",
        locations?.[0]?.name || "Main Warehouse",
      ];
      notes = [
        [],
        ["# Notes:"],
        ["# section: civil, mep, aluminium, mechanical, carpenter"],
        ["# initial_quantity: Number of items (optional)"],
        ["# location_name: Must match an existing location name exactly"],
      ];
    }

    const data = [headers, sampleRow, ...notes];

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

      const parsed: ParsedItem[] = jsonData
        .filter((row) => {
          // Skip note/comment rows
          const firstCell = String(row.item_code || "").trim();
          return firstCell && !firstCell.startsWith("#");
        })
        .map((row) => {
          const errors: string[] = [];

          const item_code = String(row.item_code || "").trim();
          const item_name = String(row.item_name || "").trim();
          const section = String(row.section || "").trim().toLowerCase() as ItemSection;
          const brand = String(row.brand || "").trim() || undefined;
          const model = String(row.model || "").trim() || undefined;
          const unit_of_measurement = String(row.unit_of_measurement || "pcs").trim();
          const description = String(row.description || "").trim() || undefined;
          const unit_cost = row.unit_cost ? Number(row.unit_cost) : undefined;

          // Machine-specific fields
          const serial_number = isMachineCategory ? String(row.serial_number || "").trim() || undefined : undefined;
          const condition = isMachineCategory
            ? (String(row.condition || "working").trim().toLowerCase() as SerialCondition)
            : undefined;
          const availability = isMachineCategory
            ? (String(row.availability || "available").trim().toLowerCase() as SerialAvailability)
            : undefined;
          const warranty_expiry = isMachineCategory ? String(row.warranty_expiry || "").trim() || undefined : undefined;
          const asset_value = isMachineCategory && row.asset_value ? Number(row.asset_value) : undefined;

          // Bulk category fields
          const initial_quantity = isBulkCategory && row.initial_quantity ? Number(row.initial_quantity) : undefined;
          const location_name = isBulkCategory ? String(row.location_name || "").trim() || undefined : undefined;
          const location_id = location_name ? locationNameMap[location_name.toLowerCase()] : undefined;

          // Validate required fields
          if (!item_code) errors.push("Missing item code");
          if (!item_name) errors.push("Missing item name");
          if (!validSections.includes(section as ItemSection)) {
            errors.push(`Invalid section: ${section}`);
          }

          // Validate machine-specific fields
          if (isMachineCategory) {
            if (!serial_number) errors.push("Missing serial number");
            if (condition && !validConditions.includes(condition)) {
              errors.push(`Invalid condition: ${condition}`);
            }
            if (availability && !validAvailabilities.includes(availability)) {
              errors.push(`Invalid availability: ${availability}`);
            }
          }

          // Validate bulk category fields
          if (isBulkCategory && initial_quantity && initial_quantity > 0) {
            if (location_name && !location_id) {
              errors.push(`Unknown location: ${location_name}`);
            }
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
            serial_number,
            condition: condition && validConditions.includes(condition) ? condition : "working",
            availability: availability && validAvailabilities.includes(availability) ? availability : "available",
            warranty_expiry,
            asset_value: asset_value && !isNaN(asset_value) ? asset_value : undefined,
            initial_quantity: initial_quantity && !isNaN(initial_quantity) ? initial_quantity : undefined,
            location_name,
            location_id,
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
      if (isMachineCategory) {
        // Use serial tracking import for machines
        const result = await bulkCreateWithSerials.mutateAsync({
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
            is_serial_tracked: true,
            serial_number: item.serial_number,
            condition: item.condition,
            availability: item.availability,
            warranty_expiry: item.warranty_expiry,
            asset_value: item.asset_value,
          })),
        });

        const successCount = result.results?.length || validItems.length;
        const errorCount = result.errors?.length || 0;

        setImportResult({
          success: successCount,
          failed: (parsedItems.length - validItems.length) + errorCount,
        });
      } else {
        // Use stock-based import for bulk categories
        const result = await bulkCreateWithStock.mutateAsync({
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
            is_serial_tracked: false,
            initial_quantity: item.initial_quantity,
            location_id: item.location_id,
          })),
        });

        const successCount = result.results?.length || validItems.length;
        const errorCount = result.errors?.length || 0;

        setImportResult({
          success: successCount,
          failed: (parsedItems.length - validItems.length) + errorCount,
        });
      }
    } catch (error: any) {
      console.error("Import error:", error);
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
    setEditingIndex(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const getConditionBadge = (condition?: string) => {
    if (!condition) return null;
    const styles: Record<string, string> = {
      working: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      under_repair: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
      damaged: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
      scrap: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
    };
    return <Badge className={styles[condition] || ""}>{condition.replace("_", " ")}</Badge>;
  };

  const getAvailabilityBadge = (availability?: string) => {
    if (!availability) return null;
    const styles: Record<string, string> = {
      available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      in_use: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
      in_transit: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
      reserved: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
    };
    return <Badge className={styles[availability] || ""}>{availability.replace("_", " ")}</Badge>;
  };

  const validCount = parsedItems.filter(i => i.is_valid).length;
  const invalidCount = parsedItems.filter(i => !i.is_valid).length;
  const isImporting = bulkCreateWithSerials.isPending || bulkCreateWithStock.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import {categoryLabel} from File</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Template Download */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <span>Download the template, fill in your data, and upload to import.</span>
                {isMachineCategory && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Machine template includes serial number fields for tracking.
                  </p>
                )}
                {isBulkCategory && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {categoryLabel} template includes initial quantity and location fields.
                  </p>
                )}
              </div>
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
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Selected: {file.name}</p>
              </div>
            )}
          </div>

          {/* No Items Parsed Message */}
          {file && !isParsing && parsedItems.length === 0 && !importResult && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No valid data rows found in the file. Please ensure your file has the correct columns matching the template.
              </AlertDescription>
            </Alert>
          )}

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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-100">
                    {validCount} valid
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive">
                      {invalidCount} with errors
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  Preview of data to be imported
                </span>
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
                      {isMachineCategory && (
                        <>
                          <TableHead>Serial Number</TableHead>
                          <TableHead>Condition</TableHead>
                          <TableHead>Availability</TableHead>
                        </>
                      )}
                      {isBulkCategory && (
                        <>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Location</TableHead>
                        </>
                      )}
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedItems.map((item, index) => {
                      const isEditing = editingIndex === index;
                      const hasErrors = !item.is_valid;
                      
                      return (
                        <TableRow key={index} className={hasErrors ? "bg-destructive/5" : ""}>
                          <TableCell>
                            {item.is_valid ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                          </TableCell>
                          
                          {/* Item Code */}
                          <TableCell>
                            {isEditing ? (
                              <Input
                                className="h-8 w-24 font-mono text-sm"
                                value={item.item_code}
                                onChange={(e) => updateItemField(index, 'item_code', e.target.value)}
                              />
                            ) : (
                              <span className="font-mono text-sm">{item.item_code || <span className="text-destructive">Missing</span>}</span>
                            )}
                          </TableCell>
                          
                          {/* Item Name */}
                          <TableCell>
                            {isEditing ? (
                              <Input
                                className="h-8 w-32"
                                value={item.item_name}
                                onChange={(e) => updateItemField(index, 'item_name', e.target.value)}
                              />
                            ) : (
                              <span className="font-medium">{item.item_name || <span className="text-destructive">Missing</span>}</span>
                            )}
                          </TableCell>
                          
                          {/* Section */}
                          <TableCell>
                            {isEditing ? (
                              <Select
                                value={item.section}
                                onValueChange={(val) => updateItemField(index, 'section', val)}
                              >
                                <SelectTrigger className="h-8 w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ITEM_SECTIONS.map((s) => (
                                    <SelectItem key={s.value} value={s.value}>
                                      {s.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary">{item.section}</Badge>
                            )}
                          </TableCell>
                          
                          {/* Brand/Model */}
                          <TableCell>
                            {item.brand || item.model
                              ? `${item.brand || ""} ${item.model || ""}`.trim()
                              : "-"}
                          </TableCell>
                          
                          {/* Unit Cost */}
                          <TableCell>
                            {item.unit_cost ? `₹${item.unit_cost.toLocaleString()}` : "-"}
                          </TableCell>
                          
                          {isMachineCategory && (
                            <>
                              {/* Serial Number */}
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    className="h-8 w-28 font-mono text-sm"
                                    placeholder="Serial #"
                                    value={item.serial_number || ""}
                                    onChange={(e) => updateItemField(index, 'serial_number', e.target.value)}
                                  />
                                ) : item.serial_number ? (
                                  <div className="flex items-center gap-1">
                                    <Hash className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-mono text-sm">{item.serial_number}</span>
                                  </div>
                                ) : (
                                  <span className="text-destructive text-sm">Missing</span>
                                )}
                              </TableCell>
                              
                              {/* Condition */}
                              <TableCell>
                                {isEditing ? (
                                  <Select
                                    value={item.condition}
                                    onValueChange={(val) => updateItemField(index, 'condition', val)}
                                  >
                                    <SelectTrigger className="h-8 w-28">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SERIAL_CONDITIONS.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>
                                          {c.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  getConditionBadge(item.condition)
                                )}
                              </TableCell>
                              
                              {/* Availability */}
                              <TableCell>
                                {isEditing ? (
                                  <Select
                                    value={item.availability}
                                    onValueChange={(val) => updateItemField(index, 'availability', val)}
                                  >
                                    <SelectTrigger className="h-8 w-28">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SERIAL_AVAILABILITIES.map((a) => (
                                        <SelectItem key={a.value} value={a.value}>
                                          {a.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  getAvailabilityBadge(item.availability)
                                )}
                              </TableCell>
                            </>
                          )}

                          {isBulkCategory && (
                            <>
                              {/* Quantity */}
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    className="h-8 w-20"
                                    type="number"
                                    min="0"
                                    value={item.initial_quantity || ""}
                                    onChange={(e) => updateItemField(index, 'initial_quantity', Number(e.target.value))}
                                  />
                                ) : (
                                  <span>{item.initial_quantity || "-"}</span>
                                )}
                              </TableCell>
                              
                              {/* Location */}
                              <TableCell>
                                {isEditing ? (
                                  <Select
                                    value={item.location_id || ""}
                                    onValueChange={(val) => {
                                      const loc = locations?.find(l => l.id === val);
                                      updateItemField(index, 'location_name', loc?.name || "");
                                      setParsedItems(prev => {
                                        const updated = [...prev];
                                        updated[index].location_id = val;
                                        return updated;
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-8 w-32">
                                      <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {locations?.map((loc) => (
                                        <SelectItem key={loc.id} value={loc.id}>
                                          {loc.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : item.location_name ? (
                                  item.location_id ? (
                                    <Badge variant="secondary">{item.location_name}</Badge>
                                  ) : (
                                    <span className="text-destructive text-sm">{item.location_name} (not found)</span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </>
                          )}
                          
                          {/* Edit Action */}
                          <TableCell>
                            {hasErrors || isEditing ? (
                              <Button
                                variant={isEditing ? "default" : "ghost"}
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setEditingIndex(isEditing ? null : index)}
                              >
                                {isEditing ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <Pencil className="h-4 w-4" />
                                )}
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Errors Summary */}
              {invalidCount > 0 && (
                <div className="mt-2">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <span>{invalidCount} row(s) have errors. Click the pencil icon to edit and fix.</span>
                      </div>
                      {parsedItems
                        .filter(i => !i.is_valid)
                        .slice(0, 3)
                        .map((item, i) => (
                          <div key={i} className="text-xs mt-1 flex items-center gap-2">
                            <span>Row {parsedItems.indexOf(item) + 1}: {item.errors.join(", ")}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1"
                              onClick={() => setEditingIndex(parsedItems.indexOf(item))}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
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
                Successfully imported {importResult.success} item(s)
                {isMachineCategory && " with serial numbers"}
                {isBulkCategory && " with initial stock"}.
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
                disabled={validCount === 0 || isImporting}
              >
                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {validCount} Item(s)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
