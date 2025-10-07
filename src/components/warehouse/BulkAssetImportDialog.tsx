import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWarehouseAssets } from "@/hooks/useWarehouseAssets";
import { useAssetCategories } from "@/hooks/useAssetCategories";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { CreateWarehouseAssetData } from "@/types/warehouse";

interface BulkAssetData extends CreateWarehouseAssetData {
  rowIndex: number;
  errors: string[];
  categoryName?: string;
  subcategoryName?: string;
  locationName?: string;
  sublocationName?: string;
  departmentName?: string;
}

export function BulkAssetImportDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<BulkAssetData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validData, setValidData] = useState<BulkAssetData[]>([]);
  const [invalidData, setInvalidData] = useState<BulkAssetData[]>([]);
  
  const { toast } = useToast();
  const { createBulkAssets, isCreatingBulk } = useWarehouseAssets();
  const { mainCategories, getSubcategories } = useAssetCategories();
  const { locations } = useWarehouseLocations();

  const downloadTemplate = () => {
    const headers = [
      'name',
      'category',
      'subcategory',
      'brand',
      'location',
      'sublocation', 
      'department',
      'condition',
      'status',
      'purchase_date',
      'purchase_price',
      'current_value',
      'description',
      'notes'
    ];
    
    const sampleData = [
      'Laptop Computer',
      'Electronics',
      'Computers',
      'Dell',
      'Main Warehouse',
      'Office Area',
      'IT Department',
      'good',
      'active',
      '2024-01-15',
      '1200.00',
      '1000.00',
      'Dell Latitude laptop for office use',
      'Assigned to IT department'
    ];

    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'asset_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const validateAndParseAssets = (csvData: string[][]): BulkAssetData[] => {
    if (csvData.length < 2) {
      toast({
        title: "Error",
        description: "CSV file must contain headers and at least one data row",
        variant: "destructive",
      });
      return [];
    }

    const headers = csvData[0].map(h => h.toLowerCase().trim());
    const dataRows = csvData.slice(1);

    return dataRows.map((row, index) => {
      const asset: BulkAssetData = {
        rowIndex: index + 2, // +2 because we skip header and 0-indexed
        errors: [],
        name: '',
        category: '',
        brand: '',
        condition: 'good',
        status: 'active',
      };

      // Map CSV columns to asset properties
      headers.forEach((header, colIndex) => {
        const value = row[colIndex]?.trim() || '';
        
        switch (header) {
          case 'name':
            asset.name = value;
            if (!value) asset.errors.push('Name is required');
            break;
          case 'category':
            asset.categoryName = value;
            if (value) {
              const category = mainCategories.find(c => 
                c.name.toLowerCase() === value.toLowerCase()
              );
              if (category) {
                asset.category = category.name;
                asset.category_id = category.id;
              } else {
                asset.errors.push(`Category "${value}" not found`);
              }
            } else {
              asset.errors.push('Category is required');
            }
            break;
          case 'subcategory':
            asset.subcategoryName = value;
            if (value && asset.category_id) {
              const subcategories = getSubcategories(asset.category_id);
              const subcategory = subcategories.find(s => 
                s.name.toLowerCase() === value.toLowerCase()
              );
              if (subcategory) {
                asset.subcategory_id = subcategory.id;
              } else {
                asset.errors.push(`Subcategory "${value}" not found`);
              }
            }
            break;
          case 'brand':
            asset.brand = value;
            break;
          case 'location':
            asset.locationName = value;
            if (value) {
              const location = locations.find(l => 
                l.name.toLowerCase() === value.toLowerCase() && l.type === 'location'
              );
              if (location) {
                asset.location_id = location.id;
              } else {
                asset.errors.push(`Location "${value}" not found`);
              }
            }
            break;
          case 'sublocation':
            asset.sublocationName = value;
            if (value) {
              const sublocation = locations.find(l => 
                l.name.toLowerCase() === value.toLowerCase() && l.type === 'sublocation'
              );
              if (sublocation) {
                asset.sublocation_id = sublocation.id;
              } else {
                asset.errors.push(`Sublocation "${value}" not found`);
              }
            }
            break;
          case 'department':
            asset.departmentName = value;
            if (value) {
              const department = locations.find(l => 
                l.name.toLowerCase() === value.toLowerCase() && l.type === 'department'
              );
              if (department) {
                asset.department_id = department.id;
              } else {
                asset.errors.push(`Department "${value}" not found`);
              }
            }
            break;
          case 'condition':
            if (value && ['good', 'fair', 'poor', 'needs_repair'].includes(value)) {
              asset.condition = value as any;
            } else if (value) {
              asset.errors.push(`Invalid condition "${value}"`);
            }
            break;
          case 'status':
            if (value && ['active', 'inactive', 'maintenance', 'disposed'].includes(value)) {
              asset.status = value as any;
            } else if (value) {
              asset.errors.push(`Invalid status "${value}"`);
            }
            break;
          case 'purchase_date':
            if (value) {
              const date = new Date(value);
              if (isNaN(date.getTime())) {
                asset.errors.push(`Invalid purchase date "${value}"`);
              } else {
                asset.purchase_date = value;
              }
            }
            break;
          case 'purchase_price':
            if (value) {
              const price = parseFloat(value);
              if (isNaN(price)) {
                asset.errors.push(`Invalid purchase price "${value}"`);
              } else {
                asset.purchase_price = price;
              }
            }
            break;
          case 'current_value':
            if (value) {
              const currentValue = parseFloat(value);
              if (isNaN(currentValue)) {
                asset.errors.push(`Invalid current value "${value}"`);
              } else {
                asset.current_value = currentValue;
              }
            }
            break;
          case 'description':
            asset.description = value;
            break;
          case 'notes':
            asset.notes = value;
            break;
        }
      });

      return asset;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Error",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setCsvFile(file);

    try {
      const text = await file.text();
      const csvData = parseCSV(text);
      const parsedAssets = validateAndParseAssets(csvData);
      
      setParsedData(parsedAssets);
      
      const valid = parsedAssets.filter(asset => asset.errors.length === 0);
      const invalid = parsedAssets.filter(asset => asset.errors.length > 0);
      
      setValidData(valid);
      setInvalidData(invalid);
      
      toast({
        title: "File Processed",
        description: `Found ${valid.length} valid and ${invalid.length} invalid records`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse CSV file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (validData.length === 0) {
      toast({
        title: "Error",
        description: "No valid data to import",
        variant: "destructive",
      });
      return;
    }

    try {
      // Clean the data - remove validation fields and ensure proper UUID handling
      const cleanedData: CreateWarehouseAssetData[] = validData.map(asset => {
        const cleanAsset: CreateWarehouseAssetData = {
          name: asset.name,
          category: asset.category,
          brand: asset.brand || undefined,
          condition: asset.condition,
          status: asset.status,
          description: asset.description || undefined,
          notes: asset.notes || undefined,
          purchase_date: asset.purchase_date || undefined,
          purchase_price: asset.purchase_price || undefined,
          current_value: asset.current_value || undefined,
        };

        // Only add UUID fields if they have valid values (not empty, not "none")
        if (asset.category_id && asset.category_id !== "none") cleanAsset.category_id = asset.category_id;
        if (asset.subcategory_id && asset.subcategory_id !== "none") cleanAsset.subcategory_id = asset.subcategory_id;
        if (asset.location_id && asset.location_id !== "none") cleanAsset.location_id = asset.location_id;
        if (asset.sublocation_id && asset.sublocation_id !== "none") cleanAsset.sublocation_id = asset.sublocation_id;
        if (asset.department_id && asset.department_id !== "none") cleanAsset.department_id = asset.department_id;

        return cleanAsset;
      });

      await createBulkAssets(cleanedData);
      
      toast({
        title: "Success",
        description: `Successfully imported ${validData.length} assets`,
      });
      setIsOpen(false);
      resetState();
    } catch (error) {
      console.error('Bulk import error:', error);
      toast({
        title: "Error",
        description: "Failed to import assets",
        variant: "destructive",
      });
    }
  };

  const resetState = () => {
    setCsvFile(null);
    setParsedData([]);
    setValidData([]);
    setInvalidData([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) resetState();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Asset Import</DialogTitle>
          <DialogDescription>
            Import multiple assets from a CSV file. Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
            
            <div className="flex-1">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
            </div>
          </div>

          {isProcessing && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Processing CSV file...</span>
            </div>
          )}

          {/* Summary */}
          {parsedData.length > 0 && (
            <div className="flex gap-4">
              <Badge variant="outline" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                {validData.length} Valid
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                {invalidData.length} Invalid
              </Badge>
            </div>
          )}

          {/* Preview Tables */}
          {validData.length > 0 && (
            <div>
              <h4 className="font-medium text-green-600 mb-3">Valid Assets ({validData.length})</h4>
              <div className="border rounded-lg max-h-60 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validData.slice(0, 10).map((asset, index) => (
                      <TableRow key={index}>
                        <TableCell>{asset.rowIndex}</TableCell>
                        <TableCell>{asset.name}</TableCell>
                        <TableCell>{asset.categoryName}</TableCell>
                        <TableCell>{asset.brand || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{asset.condition}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{asset.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {validData.length > 10 && (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    ... and {validData.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}

          {invalidData.length > 0 && (
            <div>
              <h4 className="font-medium text-red-600 mb-3">Invalid Assets ({invalidData.length})</h4>
              <div className="border rounded-lg max-h-60 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invalidData.map((asset, index) => (
                      <TableRow key={index}>
                        <TableCell>{asset.rowIndex}</TableCell>
                        <TableCell>{asset.name || '-'}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {asset.errors.map((error, errorIndex) => (
                              <Badge key={errorIndex} variant="destructive" className="mr-1">
                                {error}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {validData.length > 0 && (
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={isCreatingBulk || validData.length === 0}
              >
                {isCreatingBulk && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {validData.length} Assets
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}