import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileSpreadsheet } from 'lucide-react';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useAssetCategories } from '@/hooks/useAssetCategories';
import { useWarehouseAssetReport, WarehouseAssetReportFilters, WarehouseAssetReportItem } from '@/hooks/useWarehouseAssetReport';
import { writeExcelFromJSON } from '@/utils/excelUtils';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface WarehouseAssetReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ReportType = 'location' | 'sublocation' | 'department';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'disposed', label: 'Disposed' },
];

const CONDITION_OPTIONS = [
  { value: 'all', label: 'All Conditions' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'needs_repair', label: 'Needs Repair' },
];

export function WarehouseAssetReportDialog({ open, onOpenChange }: WarehouseAssetReportDialogProps) {
  const [reportType, setReportType] = useState<ReportType>('location');
  const [locationId, setLocationId] = useState<string>('');
  const [sublocationId, setSublocationId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [status, setStatus] = useState<string>('all');
  const [condition, setCondition] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const { locations } = useWarehouseLocations();
  const { mainCategories, getSubcategories } = useAssetCategories();
  const { fetchReport, isLoading } = useWarehouseAssetReport();

  // Filter locations by type
  const mainLocations = useMemo(() => 
    locations.filter(loc => loc.type === 'warehouse'),
    [locations]
  );

  const sublocations = useMemo(() => {
    if (!locationId) return [];
    return locations.filter(loc => loc.type === 'sublocation' && loc.parent_id === locationId);
  }, [locations, locationId]);

  const departments = useMemo(() => {
    if (!sublocationId) return [];
    return locations.filter(loc => loc.type === 'department' && loc.parent_id === sublocationId);
  }, [locations, sublocationId]);

  const subcategories = useMemo(() => {
    if (!categoryId) return [];
    return getSubcategories(categoryId);
  }, [categoryId, getSubcategories]);

  // Reset cascading filters when parent changes
  const handleLocationChange = (value: string) => {
    setLocationId(value === 'all' ? '' : value);
    setSublocationId('');
    setDepartmentId('');
  };

  const handleSublocationChange = (value: string) => {
    setSublocationId(value === 'all' ? '' : value);
    setDepartmentId('');
  };

  const handleCategoryChange = (value: string) => {
    setCategoryId(value === 'all' ? '' : value);
    setSubcategoryId('');
  };

  const handleGenerateReport = async () => {
    try {
      const filters: WarehouseAssetReportFilters = {
        locationId: locationId || undefined,
        sublocationId: sublocationId || undefined,
        departmentId: departmentId || undefined,
        categoryId: categoryId || undefined,
        subcategoryId: subcategoryId || undefined,
        status: status !== 'all' ? status : undefined,
        condition: condition !== 'all' ? condition : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        groupBy: reportType,
      };

      const reportData = await fetchReport(filters);

      if (reportData.length === 0) {
        toast.warning('No assets found matching the selected filters');
        return;
      }

      // Format data for Excel export based on report type
      const exportData = formatExportData(reportData, reportType);

      // Generate filename
      const datePart = format(new Date(), 'yyyy-MM-dd');
      const reportTypeName = reportType === 'location' ? 'Location' : 
                             reportType === 'sublocation' ? 'Sub-Location' : 'Department';
      const fileName = `asset-report-${reportTypeName}-wise-${datePart}.xlsx`;

      await writeExcelFromJSON(exportData, fileName, `${reportTypeName}-wise Report`);
      toast.success(`Exported ${reportData.length} assets to Excel`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  const formatExportData = (data: WarehouseAssetReportItem[], type: ReportType) => {
    return data.map(item => {
      const baseData: Record<string, any> = {
        'Location': item.location_name,
      };

      if (type === 'sublocation' || type === 'department') {
        baseData['Sub-Location'] = item.sublocation_name || '—';
      }

      if (type === 'department') {
        baseData['Department'] = item.department_name || '—';
      }

      return {
        ...baseData,
        'Asset Tag': item.asset_tag || '—',
        'Asset Name': item.asset_name,
        'Category': item.category_name || '—',
        'Sub-Category': item.subcategory_name || '—',
        'Brand': item.brand || '—',
        'Serial Number': item.serial_number || '—',
        'Status': item.status,
        'Condition': item.condition || '—',
        'Purchase Date': item.purchase_date || '—',
        'Purchase Price': item.purchase_price ?? '—',
        'Current Value': item.current_value ?? '—',
      };
    });
  };

  const resetFilters = () => {
    setLocationId('');
    setSublocationId('');
    setDepartmentId('');
    setCategoryId('');
    setSubcategoryId('');
    setStatus('all');
    setCondition('all');
    setStartDate('');
    setEndDate('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Warehouse Asset Reports
          </DialogTitle>
          <DialogDescription>
            Generate location, sub-location, or department-wise asset reports
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Report Type Selection */}
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Tabs value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="location">Location-wise</TabsTrigger>
                <TabsTrigger value="sublocation">Sub-Location-wise</TabsTrigger>
                <TabsTrigger value="department">Department-wise</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Location Filter */}
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={locationId || 'all'} onValueChange={handleLocationChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {mainLocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub-Location Filter */}
            <div className="space-y-2">
              <Label>Sub-Location</Label>
              <Select 
                value={sublocationId || 'all'} 
                onValueChange={handleSublocationChange}
                disabled={!locationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sub-Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub-Locations</SelectItem>
                  {sublocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department Filter */}
            <div className="space-y-2">
              <Label>Department</Label>
              <Select 
                value={departmentId || 'all'} 
                onValueChange={(v) => setDepartmentId(v === 'all' ? '' : v)}
                disabled={!sublocationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId || 'all'} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {mainCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub-Category Filter */}
            <div className="space-y-2">
              <Label>Sub-Category</Label>
              <Select 
                value={subcategoryId || 'all'} 
                onValueChange={(v) => setSubcategoryId(v === 'all' ? '' : v)}
                disabled={!categoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sub-Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub-Categories</SelectItem>
                  {subcategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condition Filter */}
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="All Conditions" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>Purchase Date From</Label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label>Purchase Date To</Label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="outline" onClick={resetFilters}>
            Reset Filters
          </Button>
          <div className="flex gap-2">
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
