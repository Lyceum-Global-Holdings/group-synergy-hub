import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
import { flattenCatalog } from '@/lib/flattenWarehouseItem';
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Package, ListPlus, AlertTriangle } from 'lucide-react';
import { useMaterialIssues } from '@/hooks/useMaterialIssues';
import { useMaterialIssueItems } from '@/hooks/useMaterialIssueItems';
import { ItemSelector } from '@/components/common/ItemSelector';
import { DualQuantityInput } from '@/components/warehouse/DualQuantityInput';
import { SrnNumberField } from '@/components/warehouse/SrnNumberField';
import { SrnDocumentUploadField } from '@/components/warehouse/SrnDocumentUploadField';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { useStockBearingLocationsForCompany } from '@/hooks/useWarehouseLocations';
import { useCompany } from '@/contexts/CompanyContext';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MaterialIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface IssueItem {
  item_id: string;
  item_code: string;
  description: string;
  unit_of_measure: string;
  quantity_required: number;
  purpose: string;
  reservation_id?: string;
  from_reservation?: boolean;
  reserved_quantity?: number;
  bin_location?: string;
  available_stock?: number;
  // Dual quantity tracking (per-item opt-in)
  track_secondary_quantity?: boolean;
  secondary_uom?: string | null;
  secondary_quantity_issued?: number;
}

export function CreateMaterialIssueDialog({ open, onOpenChange }: MaterialIssueDialogProps) {
  const [currentTab, setCurrentTab] = useState('header');
  const [formData, setFormData] = useState({
    requested_by: '',
    contact_number: '',
    epf_number: '',
    department: '',
    job_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    items_required_date: new Date().toISOString().split('T')[0],
    purpose: '',
    pr_number: '',
    po_number: '',
    notes: '',
    cpo_id: '',
    cpo_number: '',
    srn_number: '',
    location_id: '',
  });

  const [items, setItems] = useState<IssueItem[]>([]);
  const [currentItem, setCurrentItem] = useState<Partial<IssueItem>>({});
  const [reservedItems, setReservedItems] = useState<any[]>([]);
  const [locationTouched, setLocationTouched] = useState(false);
  const [srnDocumentTempPath, setSrnDocumentTempPath] = useState<string>('');

  const { items: warehouseItems } = useWarehouseItems();
  
  const { createMaterialIssueAsync, isCreating } = useMaterialIssues();
  const { createItems } = useMaterialIssueItems();
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const { toast } = useToast();

  // SAP EWM-style stock-bearing nodes: includes inherited sub-locations & departments
  const { data: stockLocations = [] } = useStockBearingLocationsForCompany(selectedCompany?.id);
  const filteredLocations = useMemo(() => stockLocations as any[], [stockLocations]);

  // Auto-default Issue Location from active context (global header location → single-location fallback)
  useEffect(() => {
    if (!open || locationTouched) return;
    if (!selectedCompany?.id) return;
    const inScope = globalLocationId && filteredLocations.some((l) => l.id === globalLocationId);
    if (inScope) {
      setFormData((prev) => (prev.location_id === globalLocationId ? prev : { ...prev, location_id: globalLocationId as string }));
    } else if (filteredLocations.length === 1) {
      const only = filteredLocations[0].id;
      setFormData((prev) => (prev.location_id === only ? prev : { ...prev, location_id: only }));
    } else {
      setFormData((prev) => (prev.location_id ? { ...prev, location_id: '' } : prev));
    }
  }, [open, locationTouched, selectedCompany?.id, globalLocationId, filteredLocations]);


  // Fetch confirmed CPOs
  const { data: confirmedCPOs = [] } = useQuery({
    queryKey: ['confirmed-cpos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_purchase_orders')
        .select('id, cpo_number, customer:customers(customer_name), status, delivery_date')
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch reservations when CPO is selected
  useEffect(() => {
    if (formData.cpo_id) {
      fetchReservations();
    } else {
      setReservedItems([]);
    }
  }, [formData.cpo_id]);

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from('warehouse_item_reservations')
      .select(`
        id,
        warehouse_item_id,
        reserved_quantity,
        quantity_issued,
        quantity_remaining,
        status,
        warehouse_item:warehouse_items(
            id,
            unit_of_measure,
            current_stock,
            reserved_quantity,
            catalog:warehouse_item_catalog!warehouse_items_catalog_item_id_fkey(item_code, name)
          ),
        bin_allocation:warehouse_bin_allocations(
          bin:warehouse_bins(bin_code, name)
        )
      `)
      .eq('reference_type', 'cpo')
      .eq('reference_id', formData.cpo_id)
      .in('status', ['active', 'partially_issued']);

    if (!error && data) {
      setReservedItems(data);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCPOSelect = (cpoId: string) => {
    const selectedCPO = confirmedCPOs.find(cpo => cpo.id === cpoId);
    setFormData(prev => ({
      ...prev,
      cpo_id: cpoId,
      cpo_number: selectedCPO?.cpo_number || '',
    }));
  };

  const handleItemSelect = (item: any) => {
    if (item && item.id) {
      const wi: any = warehouseItems.find((w: any) => w.id === item.id) || {};
      setCurrentItem({
        item_id: item.id,
        item_code: item.item_code,
        description: item.description || item.item_name,
        unit_of_measure: item.unit_of_measure,
        quantity_required: 1,
        purpose: '',
        available_stock: item.current_stock || 0,
        track_secondary_quantity: !!wi.track_secondary_quantity,
        secondary_uom: wi.secondary_uom || null,
        secondary_quantity_issued: undefined,
      });
    }
  };

  const addItem = () => {
    if (currentItem.item_id && currentItem.quantity_required) {
      setItems([...items, currentItem as unknown as IssueItem]);
      setCurrentItem({});
    }
  };

  const handleAddAllReservedItems = () => {
    const newItems: IssueItem[] = reservedItems
      .filter(res => res.warehouse_item && res.quantity_remaining > 0)
      .map(res => {
        const wi: any = warehouseItems.find((w: any) => w.id === res.warehouse_item.id) || {};
        return {
          item_id: res.warehouse_item.id,
          item_code: res.warehouse_item.item_code,
          description: res.warehouse_item.name,
          unit_of_measure: res.warehouse_item.unit_of_measure,
          quantity_required: res.quantity_remaining,
          purpose: `Reserved for CPO ${formData.cpo_number}`,
          reservation_id: res.id,
          from_reservation: true,
          reserved_quantity: res.reserved_quantity,
          bin_location: res.bin_allocation?.bin?.bin_code || 'N/A',
          available_stock: res.warehouse_item.current_stock || 0,
          track_secondary_quantity: !!wi.track_secondary_quantity,
          secondary_uom: wi.secondary_uom || null,
        };
      });

    setItems(prev => [...prev, ...newItems]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.requested_by || items.length === 0) return;
    if (!formData.location_id) {
      toast({
        title: 'Location Required',
        description: 'Please select an Issue Location. Stock is always issued from a specific storage location.',
        variant: 'destructive',
      });
      setCurrentTab('header');
      return;
    }

    // Dual-tracked items must have a positive secondary quantity
    const missingSecondary = items.find(
      (it) => it.track_secondary_quantity && (!it.secondary_quantity_issued || it.secondary_quantity_issued <= 0)
    );
    if (missingSecondary) {
      toast({
        title: 'Pieces required',
        description: `Enter the piece count (${missingSecondary.secondary_uom || 'pcs'}) for ${missingSecondary.item_code || missingSecondary.description}.`,
        variant: 'destructive',
      });
      setCurrentTab('items');
      return;
    }
    if (!selectedCompany?.id) {
      toast({
        title: 'Company Required',
        description: 'Please select a company in the header before creating a material issue.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const issueNote = await createMaterialIssueAsync({
        issue_date: formData.issue_date,
        issued_to: formData.requested_by,
        department: formData.department || undefined,
        purpose: formData.purpose || undefined,
        notes: formData.notes || undefined,
        cpo_id: formData.cpo_id || undefined,
        cpo_number: formData.cpo_number || undefined,
        requested_by: formData.requested_by,
        contact_number: formData.contact_number || undefined,
        epf_number: formData.epf_number || undefined,
        items_required_date: formData.items_required_date,
        job_number: formData.job_number || undefined,
        pr_number: formData.pr_number || undefined,
        po_number: formData.po_number || undefined,
        location_id: formData.location_id,
        company_id: selectedCompany.id,
        srn_number: formData.srn_number || undefined,
      });

      // Move SRN document from temp/ folder into the new MIN folder, then persist column.
      if (srnDocumentTempPath && issueNote?.id && selectedCompany?.id) {
        try {
          const ext = srnDocumentTempPath.split('.').pop() ?? 'bin';
          const finalPath = `${selectedCompany.id}/${issueNote.id}/srn_${Date.now()}.${ext}`;
          const { error: moveErr } = await supabase.storage
            .from('min-srn-documents')
            .move(srnDocumentTempPath, finalPath);
          const persistedPath = moveErr ? srnDocumentTempPath : finalPath;
          await supabase
            .from('material_issue_notes')
            .update({ srn_document_url: persistedPath })
            .eq('id', issueNote.id);
        } catch (e) {
          console.error('Failed to attach SRN document to MIN', e);
        }
      }

      // Create items with reservation linkage
      const itemsToCreate = items.map((item, index) => ({
        min_id: issueNote.id,
        item_id: item.item_id,
        quantity_issued: item.quantity_required,
        quantity_required: item.quantity_required,
        line_number: index + 1,
        item_code: item.item_code,
        description: item.description,
        unit_of_measure: item.unit_of_measure,
        purpose: item.purpose || undefined,
        reservation_id: item.reservation_id,
        from_reservation: item.from_reservation || false,
        secondary_quantity_issued: item.track_secondary_quantity
          ? (item.secondary_quantity_issued ?? null)
          : null,
        secondary_uom: item.track_secondary_quantity ? (item.secondary_uom ?? null) : null,
      }));

      await createItems(itemsToCreate);

      // Reset form
      setFormData({
        requested_by: '',
        contact_number: '',
        epf_number: '',
        department: '',
        job_number: '',
        issue_date: new Date().toISOString().split('T')[0],
        items_required_date: new Date().toISOString().split('T')[0],
        purpose: '',
        pr_number: '',
        po_number: '',
        notes: '',
        cpo_id: '',
        cpo_number: '',
        srn_number: '',
        location_id: '',
      });
      setItems([]);
      setReservedItems([]);
      setLocationTouched(false);
      setSrnDocumentTempPath('');
      setCurrentTab('header');
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating material issue:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Material Issue Note</DialogTitle>
          <DialogDescription>
            Fill in the material issue details in three steps
          </DialogDescription>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="header">Header Info</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>

          <TabsContent value="header" className="space-y-4">
            {/* CPO Selection */}
            <div className="space-y-2">
              <Label htmlFor="cpo_id">Customer Purchase Order (Optional)</Label>
              <Select value={formData.cpo_id} onValueChange={handleCPOSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select CPO to issue reserved items" />
                </SelectTrigger>
                <SelectContent>
                  {confirmedCPOs.map((cpo) => (
                    <SelectItem key={cpo.id} value={cpo.id}>
                      {cpo.cpo_number} - {cpo.customer?.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.cpo_number && (
              <Alert>
                <Package className="h-4 w-4" />
                <AlertDescription>
                  Issuing materials for CPO: <strong>{formData.cpo_number}</strong>
                  <br />
                  {reservedItems.length} items reserved
                </AlertDescription>
              </Alert>
            )}

            {/* Location Selection */}
            <div className="space-y-2">
              <Label htmlFor="location_id">Issue Location <span className="text-destructive">*</span></Label>
              <Select
                value={formData.location_id}
                onValueChange={(value) => {
                  setLocationTouched(true);
                  handleInputChange('location_id', value);
                }}
                disabled={!selectedCompany?.id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedCompany?.id ? "Select storage location for this issue" : "Select a company first"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredLocations.map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {'\u00A0\u00A0'.repeat(Math.max(0, loc.depth ?? 0))}{loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedCompany?.name
                  ? <>Company: <strong>{selectedCompany.name}</strong>{!locationTouched && formData.location_id ? ' — auto-selected from header context.' : '. Stock will be issued only from bins at the selected location.'}</>
                  : 'Stock will be issued only from bins at the selected location.'}
              </p>
            </div>

            <SrnNumberField
              value={formData.srn_number}
              onChange={(v) => handleInputChange('srn_number', v)}
            />

            <SrnDocumentUploadField
              companyId={selectedCompany?.id}
              currentDocumentUrl={srnDocumentTempPath || undefined}
              onUpload={(path) => setSrnDocumentTempPath(path)}
            />


            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requested_by">Requested By *</Label>
                <Input
                  id="requested_by"
                  value={formData.requested_by}
                  onChange={(e) => handleInputChange('requested_by', e.target.value)}
                  placeholder="Name of requester"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  placeholder="Department name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_number">Contact Number</Label>
                <Input
                  id="contact_number"
                  value={formData.contact_number}
                  onChange={(e) => handleInputChange('contact_number', e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="epf_number">EPF Number</Label>
                <Input
                  id="epf_number"
                  value={formData.epf_number}
                  onChange={(e) => handleInputChange('epf_number', e.target.value)}
                  placeholder="Employee EPF number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_number">Job Number</Label>
                <Input
                  id="job_number"
                  value={formData.job_number}
                  onChange={(e) => handleInputChange('job_number', e.target.value)}
                  placeholder="Job/Project reference"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue_date">Date of Request</Label>
                <Input
                  id="issue_date"
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => handleInputChange('issue_date', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="items_required_date">Items Required Date</Label>
                <Input
                  id="items_required_date"
                  type="date"
                  value={formData.items_required_date}
                  onChange={(e) => handleInputChange('items_required_date', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr_number">PR Number (if any)</Label>
                <Input
                  id="pr_number"
                  value={formData.pr_number}
                  onChange={(e) => handleInputChange('pr_number', e.target.value)}
                  placeholder="Purchase requisition number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose of Issue *</Label>
              <Textarea
                id="purpose"
                value={formData.purpose}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
                placeholder="Describe the purpose of this issue"
                rows={3}
                required
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setCurrentTab('items')}>
                Next: Add Items
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
            {reservedItems.length > 0 && (
              <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Reserved Items for {formData.cpo_number}</h3>
                  <Button onClick={handleAddAllReservedItems} size="sm">
                    <ListPlus className="h-4 w-4 mr-2" />
                    Add All Reserved Items
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {reservedItems.length} reserved items available
                </div>
              </div>
            )}

            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Add Item</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Item *</Label>
                  <ItemSelector
                    value={currentItem.item_id || ''}
                    onSelect={handleItemSelect}
                    placeholder={formData.location_id ? "Search for item..." : "Select location first"}
                    disabled={!formData.location_id}
                    locationId={formData.location_id || undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity Required *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentItem.quantity_required || ''}
                    onChange={(e) => setCurrentItem({ ...currentItem, quantity_required: parseFloat(e.target.value) })}
                    placeholder="Enter quantity"
                  />
                </div>
              </div>

              {currentItem.track_secondary_quantity && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <DualQuantityInput
                    baseValue={String(currentItem.quantity_required ?? '')}
                    secondaryValue={String(currentItem.secondary_quantity_issued ?? '')}
                    onBaseChange={(v) => setCurrentItem({ ...currentItem, quantity_required: parseFloat(v) || 0 })}
                    onSecondaryChange={(v) => setCurrentItem({ ...currentItem, secondary_quantity_issued: parseFloat(v) || 0 })}
                    baseUom={currentItem.unit_of_measure}
                    secondaryUom={currentItem.secondary_uom || 'pcs'}
                    baseLabel="Qty issued"
                    secondaryLabel="Pieces issued"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Item Code</Label>
                  <Input value={currentItem.item_code || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Unit of Measure</Label>
                  <Input value={currentItem.unit_of_measure || ''} disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={currentItem.description || ''} disabled />
              </div>

              <div className="space-y-2">
                <Label>Purpose (for this item)</Label>
                <Input
                  value={currentItem.purpose || ''}
                  onChange={(e) => setCurrentItem({ ...currentItem, purpose: e.target.value })}
                  placeholder="Specific purpose for this item"
                />
              </div>

              <Button onClick={addItem} disabled={!currentItem.item_id || !currentItem.quantity_required}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {items.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead>Qty Required</TableHead>
                      <TableHead>Reserved</TableHead>
                      <TableHead>Bin</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{item.item_code}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.unit_of_measure}</TableCell>
                        <TableCell>{item.quantity_required}</TableCell>
                        <TableCell>
                          {item.from_reservation ? (
                            <Badge variant="secondary">Reserved</Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{item.bin_location || '-'}</TableCell>
                        <TableCell>{item.purpose || '-'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentTab('header')}>
                Back
              </Button>
              <Button onClick={() => setCurrentTab('review')} disabled={items.length === 0}>
                Next: Review
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            {/* Stock Impact Warning */}
            <Alert className="border-warning bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle>Stock Impact Notice</AlertTitle>
              <AlertDescription>
                Issuing these materials will:
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>Reduce warehouse stock quantities</li>
                  <li>Update bin allocations (if from reservation)</li>
                  <li>Close or update reservations</li>
                  <li>Create audit trail in stock movements</li>
                </ul>
                <div className="mt-3 pt-2 border-t border-warning/20 font-medium">
                  Total items: {items.length} | Total quantity: {items.reduce((sum, item) => sum + item.quantity_required, 0).toFixed(2)} units
                </div>
              </AlertDescription>
            </Alert>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-lg">Header Information</h3>
              {formData.cpo_number && (
                <div className="text-sm">
                  <span className="font-medium">CPO:</span> {formData.cpo_number}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="font-medium">Requested By:</span> {formData.requested_by}</div>
                <div><span className="font-medium">Department:</span> {formData.department}</div>
                <div><span className="font-medium">Contact:</span> {formData.contact_number || '-'}</div>
                <div><span className="font-medium">EPF:</span> {formData.epf_number || '-'}</div>
                <div><span className="font-medium">Job Number:</span> {formData.job_number || '-'}</div>
                <div><span className="font-medium">Request Date:</span> {formData.issue_date}</div>
                <div><span className="font-medium">Required Date:</span> {formData.items_required_date}</div>
                <div><span className="font-medium">PR Number:</span> {formData.pr_number || '-'}</div>
              </div>
              <div>
                <span className="font-medium">Purpose:</span>
                <p className="text-sm mt-1">{formData.purpose}</p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Qty Required</TableHead>
                    <TableHead>Available Stock</TableHead>
                    <TableHead>Reserved</TableHead>
                    <TableHead>Purpose</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{item.item_code}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.unit_of_measure}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{item.quantity_required}</span>
                          {item.bin_location && item.bin_location !== 'N/A' && (
                            <span className="text-xs text-muted-foreground">
                              Bin: {item.bin_location}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{item.available_stock !== undefined ? item.available_stock : 'N/A'}</span>
                          {item.available_stock !== undefined && item.available_stock < item.quantity_required && (
                            <span className="text-xs text-destructive font-medium flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Low stock
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.from_reservation ? (
                          <Badge variant="secondary">Reserved</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{item.purpose || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentTab('items')}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Material Issue Note'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
