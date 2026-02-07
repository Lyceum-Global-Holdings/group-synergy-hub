import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { FileSpreadsheet, Loader2, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAssetLocationReport, AssetLocationReportItem } from '@/hooks/useAssetLocationReport';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useAssetCategories } from '@/hooks/useAssetCategories';
import { useCompany } from '@/contexts/CompanyContext';
import { writeExcelFromJSON } from '@/utils/excelUtils';
import { toast } from 'sonner';

interface AssetLocationReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ASSET_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In Use' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'disposed', label: 'Disposed' },
  { value: 'retired', label: 'Retired' },
];

export function AssetLocationReportDialog({ open, onOpenChange }: AssetLocationReportDialogProps) {
  const { selectedCompany } = useCompany();
  const { locations } = useWarehouseLocations();
  const { mainCategories } = useAssetCategories();
  const { fetchReport, isLoading } = useAssetLocationReport();
  
  const [locationId, setLocationId] = useState<string>('all');
  const [sublocationId, setSublocationId] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Filter locations for main locations (no parent)
  const mainLocations = useMemo(() => 
    locations.filter(loc => !loc.parent_id),
    [locations]
  );

  // Filter sublocations based on selected location
  const sublocations = useMemo(() => {
    if (locationId === 'all') return [];
    return locations.filter(loc => loc.parent_id === locationId);
  }, [locations, locationId]);

  // Reset sublocation when location changes
  const handleLocationChange = (value: string) => {
    setLocationId(value);
    setSublocationId('all');
  };

  const formatStatus = (statusValue: string): string => {
    return statusValue.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleGenerateReport = async () => {
    try {
      const reportData = await fetchReport({
        locationId: locationId !== 'all' ? locationId : undefined,
        sublocationId: sublocationId !== 'all' ? sublocationId : undefined,
        categoryId: categoryId !== 'all' ? categoryId : undefined,
        status: status !== 'all' ? status : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (reportData.length === 0) {
        toast.info('No assets found for the selected criteria');
        return;
      }

      // Transform to export format
      const exportData = reportData.map((item: AssetLocationReportItem) => ({
        'Location': item.location_name,
        'Sub-Location': item.sublocation_name || '',
        'Asset Tag': item.asset_tag || '',
        'Asset Name': item.asset_name,
        'Brand': item.brand || '',
        'Category': item.category_name || '',
        'Sub-Category': item.subcategory_name || '',
        'Serial Number': item.serial_number || '',
        'Status': formatStatus(item.status),
        'Condition': item.condition || '',
        'Purchase Date': item.purchase_date ? format(new Date(item.purchase_date), 'yyyy-MM-dd') : '',
        'Purchase Price (LKR)': item.purchase_price || 0,
        'Current Value (LKR)': item.current_value || 0,
        'Accum. Depreciation (LKR)': item.accumulated_depreciation || 0,
        'Depreciation Method': item.depreciation_method || '',
        'Useful Life (Years)': item.useful_life_years || '',
        'Notes': item.notes || '',
      }));

      // Generate filename
      const companyName = selectedCompany?.name
        ? selectedCompany.name.toLowerCase().replace(/\s+/g, '-')
        : 'all-companies';
      
      const locationPart = locationId !== 'all' 
        ? mainLocations.find(l => l.id === locationId)?.name?.toLowerCase().replace(/\s+/g, '-') || 'location'
        : 'all-locations';
      
      const datePart = format(new Date(), 'yyyy-MM-dd');
      const fileName = `asset-location-report-${companyName}-${locationPart}-${datePart}.xlsx`;

      await writeExcelFromJSON(exportData, fileName, 'Asset Location Report');
      toast.success(`Exported ${reportData.length} assets to Excel`);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate asset location report');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Asset Location Report
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select value={locationId} onValueChange={handleLocationChange}>
                <SelectTrigger id="location">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {mainLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sublocation">Sub-Location</Label>
              <Select 
                value={sublocationId} 
                onValueChange={setSublocationId}
                disabled={locationId === 'all'}
              >
                <SelectTrigger id="sublocation">
                  <SelectValue placeholder="All Sub-Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub-Locations</SelectItem>
                  {sublocations.map((sublocation) => (
                    <SelectItem key={sublocation.id} value={sublocation.id}>
                      {sublocation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {mainCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Purchase Date From</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Purchase Date To</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Generate a detailed report of assets organized by location and sub-location. All filters are optional.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerateReport} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Generate Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
