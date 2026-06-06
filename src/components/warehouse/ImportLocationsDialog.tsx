import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useToast } from '@/hooks/use-toast';

export function ImportLocationsDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  
  const { createLocation } = useWarehouseLocations();
  const { toast } = useToast();

  const handleDownloadTemplate = () => {
    const template = `name,type,parent_id,description,location_code,capacity,contact_person,contact_phone,physical_address,status
Main Warehouse,location,,Primary storage facility,WH-001,10000,John Smith,555-0001,123 Industrial Ave,active
Receiving Area,sublocation,WH-001,Goods receiving zone,WH-001-RCV,2000,Jane Doe,555-0002,,active
Production Floor,department,WH-001-RCV,Manufacturing area,WH-001-PROD,3000,Bob Johnson,555-0003,,active`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'location_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setResults(null);
    } else {
      toast({
        title: 'Invalid file',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResults(null);

    try {
      const text = await file.text();
      const locations = parseCSV(text);
      
      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const loc of locations) {
        try {
          if (!loc.name || !loc.type) {
            errors.push(`Row skipped: Missing required fields (name: ${loc.name}, type: ${loc.type})`);
            failedCount++;
            continue;
          }

          await createLocation({
            name: loc.name,
            type: loc.type as 'warehouse' | 'sublocation' | 'department',
            parent_id: loc.parent_id || undefined,
            description: loc.description || undefined,
            location_code: loc.location_code || undefined,
            capacity: loc.capacity ? parseFloat(loc.capacity) : undefined,
            contact_person: loc.contact_person || undefined,
            contact_phone: loc.contact_phone || undefined,
            physical_address: loc.physical_address || undefined,
            status: (loc.status as 'active' | 'inactive' | 'maintenance' | 'closed') || 'active',
          });
          successCount++;
        } catch (error: any) {
          errors.push(`Failed to import "${loc.name}": ${error.message}`);
          failedCount++;
        }
      }

      setResults({ success: successCount, failed: failedCount, errors });
      
      if (successCount > 0) {
        toast({
          title: 'Import completed',
          description: `Successfully imported ${successCount} location(s)`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Import Locations
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Locations from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              Download the template CSV file, fill in your location data, and upload it to bulk import locations.
            </AlertDescription>
          </Alert>

          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>

          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium mb-2">
              Upload CSV File
            </label>
            <Input
              id="file-upload"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
            />
            {file && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {file.name}
              </p>
            )}
          </div>

          {results && (
            <div className="space-y-2">
              {results.success > 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Successfully imported {results.success} location(s)
                  </AlertDescription>
                </Alert>
              )}
              
              {results.failed > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">
                      Failed to import {results.failed} location(s):
                    </div>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {results.errors.slice(0, 5).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                      {results.errors.length > 5 && (
                        <li>... and {results.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing ? 'Importing...' : 'Import Locations'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}