import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, ArrowLeft, ArrowRight, CheckCircle, Package } from "lucide-react";
import { useMaterialRequests } from "@/hooks/useMaterialRequests";
import { useMaterialRequestItems } from "@/hooks/useMaterialRequestItems";
import { useWarehouseReservations } from "@/hooks/useWarehouseReservations";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { ItemSelector } from "@/components/common/ItemSelector";
import { SrnNumberField } from "@/components/warehouse/SrnNumberField";
import { SrnDocumentUploadField } from "@/components/warehouse/SrnDocumentUploadField";
import { useCompany } from "@/contexts/CompanyContext";
import { MaterialRequestPriority } from "@/types/materialIssueReturn";
import { WarehouseItem } from "@/types/itemBin";
import { ReservationWithDetails } from "@/types/warehouseReservation";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { flattenCatalog } from '@/lib/flattenWarehouseItem';

interface CreateMaterialRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RequestItem {
  item_id: string;
  item_code: string;
  description: string;
  unit_of_measure: string;
  quantity_requested: number;
  purpose?: string;
  notes?: string;
  _reservation?: ReservationWithDetails;
}

export function CreateMaterialRequestDialog({ open, onOpenChange }: CreateMaterialRequestDialogProps) {
  const [step, setStep] = useState(1);
  const [requestData, setRequestData] = useState({
    request_date: new Date().toISOString().split('T')[0],
    requested_by: "",
    location_id: "",
    contact_number: "",
    epf_number: "",
    job_number: "",
    cpo_id: "",
    cpo_number: "",
    srn_number: "",
    items_required_date: "",
    purpose: "",
    priority: "medium" as unknown as MaterialRequestPriority,
    notes: "",
  });
  const [items, setItems] = useState<RequestItem[]>([]);
  const [cpoReservations, setCpoReservations] = useState<ReservationWithDetails[]>([]);
  const [srnDocumentTempPath, setSrnDocumentTempPath] = useState<string>("");

  const { selectedCompany } = useCompany();
  const { createRequestAsync, isCreating } = useMaterialRequests();
  const { createItems } = useMaterialRequestItems();
  const { locations } = useWarehouseLocations();
  const { data: userProfile } = useCurrentUserProfile();

  // Default requested_by to current user when dialog opens
  useEffect(() => {
    if (open && userProfile?.full_name && !requestData.requested_by) {
      setRequestData(prev => ({ ...prev, requested_by: userProfile.full_name || "" }));
    }
  }, [open, userProfile]);

  // Fetch confirmed CPOs
  const { data: confirmedCPOs } = useQuery({
    queryKey: ['confirmed-cpos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_purchase_orders')
        .select(`
          id, 
          cpo_number,
          customer:customers(customer_name)
        `)
        .eq('status', 'confirmed')
        .order('cpo_number', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch reservations when CPO is selected
  useEffect(() => {
    if (requestData.cpo_id) {
      fetchCPOReservations(requestData.cpo_id);
    } else {
      setCpoReservations([]);
    }
  }, [requestData.cpo_id]);

  const fetchCPOReservations = async (cpoId: string) => {
    const { data, error } = await supabase
      .from('warehouse_item_reservations')
      .select(`
        *,
        warehouse_item:warehouse_items(
            id,
            current_stock,
            reserved_quantity,
            catalog:warehouse_item_catalog!warehouse_items_catalog_item_id_fkey(item_code, name)
          ),
        bin_allocation:warehouse_bin_allocations(
          id,
          allocated_quantity,
          available_quantity,
          bin:warehouse_bins(bin_code, name)
        )
      `)
      .eq('reference_id', cpoId)
      .in('status', ['active', 'partially_issued']);

    if (!error && data) {
      setCpoReservations(data as unknown as ReservationWithDetails[]);
    }
  };

  const handleAddItem = (selectedItem: WarehouseItem | null) => {
    if (!selectedItem) return;

    // Find reservation for this item
    const reservation = cpoReservations.find(
      r => r.warehouse_item_id === selectedItem.id
    );

    setItems([...items, {
      item_id: selectedItem.id,
      item_code: selectedItem.item_code || "",
      description: selectedItem.description || "",
      unit_of_measure: "pcs",
      quantity_requested: reservation?.quantity_remaining || 1,
      purpose: reservation ? `For CPO ${requestData.cpo_number}` : "",
      notes: reservation ? `Reserved in bin ${reservation.bin_allocation?.bin.bin_code}` : "",
      _reservation: reservation,
    }]);
  };

  const handleAddAllReservedItems = () => {
    const newItems = cpoReservations
      .filter(res => !items.some(item => item.item_id === res.warehouse_item_id))
      .map((res) => ({
        item_id: res.warehouse_item_id,
        item_code: res.warehouse_item?.item_code || "",
        description: res.warehouse_item?.name || "",
        unit_of_measure: "pcs",
        quantity_requested: res.quantity_remaining,
        purpose: `For CPO ${requestData.cpo_number}`,
        notes: `Reserved in bin ${res.bin_allocation?.bin.bin_code}`,
        _reservation: res,
      }));
    
    setItems([...items, ...newItems]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof RequestItem, value: string | number) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const { submitForApproval } = useMaterialRequests();

  const handleSubmit = async (submitForApprovalFlag: boolean = false) => {
    try {
      // Create the request
      const newRequest = await createRequestAsync(requestData);

      // Move SRN document from temp/ into the new request folder, then persist column.
      if (srnDocumentTempPath && newRequest?.id && selectedCompany?.id) {
        try {
          const ext = srnDocumentTempPath.split('.').pop() ?? 'bin';
          const finalPath = `${selectedCompany.id}/${newRequest.id}/srn_${Date.now()}.${ext}`;
          const { error: moveErr } = await supabase.storage
            .from('min-srn-documents')
            .move(srnDocumentTempPath, finalPath);
          const persistedPath = moveErr ? srnDocumentTempPath : finalPath;
          await supabase
            .from('material_requests')
            .update({ srn_document_url: persistedPath })
            .eq('id', newRequest.id);
        } catch (e) {
          console.error('Failed to attach SRN document to request', e);
        }
      }

      // Create the items
      if (items.length > 0 && newRequest) {
        await createItems(items.map((item, index) => ({
          request_id: newRequest.id,
          item_id: item.item_id,
          item_code: item.item_code,
          description: item.description,
          unit_of_measure: item.unit_of_measure,
          quantity_requested: item.quantity_requested,
          purpose: item.purpose,
          notes: item.notes,
          line_number: index + 1,
        })));
      }

      // Submit for approval if requested
      if (submitForApprovalFlag && newRequest) {
        await submitForApproval(newRequest.id);
      }

      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error creating material request:", error);
    }
  };


  const resetForm = () => {
    setStep(1);
    setRequestData({
      request_date: new Date().toISOString().split('T')[0],
      requested_by: userProfile?.full_name || "",
      location_id: "",
      contact_number: "",
      epf_number: "",
      job_number: "",
      cpo_id: "",
      cpo_number: "",
      srn_number: "",
      items_required_date: "",
      purpose: "",
      priority: "medium",
      notes: "",
    });
    setItems([]);
    setCpoReservations([]);
    setSrnDocumentTempPath("");
  };


  const canProceedToStep2 = requestData.requested_by && requestData.items_required_date && requestData.purpose;
  const canSubmit = items.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Material Request</DialogTitle>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              1
            </div>
            <span className="text-sm font-medium">Header</span>
          </div>
          <div className="w-12 h-px bg-border" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              2
            </div>
            <span className="text-sm font-medium">Items</span>
          </div>
          <div className="w-12 h-px bg-border" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 3 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              3
            </div>
            <span className="text-sm font-medium">Review</span>
          </div>
        </div>

        {/* Step 1: Header Information */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="request_date">Request Date</Label>
                <Input
                  id="request_date"
                  type="date"
                  value={requestData.request_date}
                  onChange={(e) => setRequestData({ ...requestData, request_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="items_required_date">Date Items Required *</Label>
                <Input
                  id="items_required_date"
                  type="date"
                  value={requestData.items_required_date}
                  onChange={(e) => setRequestData({ ...requestData, items_required_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="requested_by">Requested By *</Label>
                <Input
                  id="requested_by"
                  value={requestData.requested_by}
                  onChange={(e) => setRequestData({ ...requestData, requested_by: e.target.value })}
                  placeholder="Employee name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="location_id">Location</Label>
                <Select
                  value={requestData.location_id}
                  onValueChange={(value) => setRequestData({ ...requestData, location_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations?.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="contact_number">Contact Number</Label>
                <Input
                  id="contact_number"
                  value={requestData.contact_number}
                  onChange={(e) => setRequestData({ ...requestData, contact_number: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div>
                <Label htmlFor="epf_number">EPF Number</Label>
                <Input
                  id="epf_number"
                  value={requestData.epf_number}
                  onChange={(e) => setRequestData({ ...requestData, epf_number: e.target.value })}
                  placeholder="Employee EPF number"
                />
              </div>
              <div>
                <Label htmlFor="job_number">Job Number</Label>
                <Input
                  id="job_number"
                  value={requestData.job_number}
                  onChange={(e) => setRequestData({ ...requestData, job_number: e.target.value })}
                  placeholder="Job/Work order number"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cpo_number">CPO Number (Optional)</Label>
              <Select 
                value={requestData.cpo_id} 
                onValueChange={(value) => {
                  const selectedCPO = confirmedCPOs?.find(cpo => cpo.id === value);
                  setRequestData({ 
                    ...requestData, 
                    cpo_id: value,
                    cpo_number: selectedCPO?.cpo_number || ""
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select CPO (if applicable)" />
                </SelectTrigger>
                <SelectContent>
                  {confirmedCPOs?.map(cpo => (
                    <SelectItem key={cpo.id} value={cpo.id}>
                      {cpo.cpo_number} - {(cpo.customer as any)?.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Link to CPO to view reserved materials
              </p>
            </div>

            <SrnNumberField
              value={requestData.srn_number}
              onChange={(v) => setRequestData({ ...requestData, srn_number: v })}
            />

            <SrnDocumentUploadField
              companyId={selectedCompany?.id}
              currentDocumentUrl={srnDocumentTempPath}
              onUpload={setSrnDocumentTempPath}
            />


            <div>
              <Label htmlFor="purpose">Purpose *</Label>
              <Textarea
                id="purpose"
                value={requestData.purpose}
                onChange={(e) => setRequestData({ ...requestData, purpose: e.target.value })}
                placeholder="Reason for material request"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={requestData.priority} onValueChange={(value: MaterialRequestPriority) => setRequestData({ ...requestData, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={requestData.notes}
                  onChange={(e) => setRequestData({ ...requestData, notes: e.target.value })}
                  placeholder="Additional notes"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!canProceedToStep2}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Items */}
        {step === 2 && (
          <div className="space-y-4">
            {requestData.cpo_number && (
              <Alert>
                <Package className="h-4 w-4" />
                <AlertDescription>
                  Linked to CPO: <strong>{requestData.cpo_number}</strong>
                  {cpoReservations.length > 0 && (
                    <span className="ml-2">
                      ({cpoReservations.length} items reserved)
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <div className="flex-1">
                <ItemSelector
                  value=""
                  onSelect={handleAddItem}
                  placeholder="Select item to add"
                />
              </div>
              {cpoReservations.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={handleAddAllReservedItems}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add All Reserved Items
                </Button>
              )}
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Qty Required</TableHead>
                    <TableHead>Reserved</TableHead>
                    <TableHead>Bin Location</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No items added yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.item_code}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.unit_of_measure}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity_requested}
                            onChange={(e) => handleItemChange(index, 'quantity_requested', parseFloat(e.target.value))}
                            className="w-20"
                            min="0.01"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          {item._reservation ? (
                            <Badge variant="secondary">
                              {item._reservation.quantity_remaining}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item._reservation?.bin_allocation?.bin.bin_code || "-"}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.purpose || ""}
                            onChange={(e) => handleItemChange(index, 'purpose', e.target.value)}
                            placeholder="Purpose"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.notes || ""}
                            onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                            placeholder="Notes"
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canSubmit}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-semibold">Request Details</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Requested By:</span> {requestData.requested_by}</div>
                <div><span className="text-muted-foreground">Location:</span> {locations?.find(l => l.id === requestData.location_id)?.name || "N/A"}</div>
                <div><span className="text-muted-foreground">Date Required:</span> {requestData.items_required_date}</div>
                <div><span className="text-muted-foreground">Priority:</span> {requestData.priority}</div>
                {requestData.cpo_number && (
                  <div className="col-span-2"><span className="text-muted-foreground">CPO Number:</span> <Badge variant="outline">{requestData.cpo_number}</Badge></div>
                )}
                <div className="col-span-2"><span className="text-muted-foreground">Purpose:</span> {requestData.purpose}</div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Items ({items.length})</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty Required</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Reserved Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.item_code}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.quantity_requested}</TableCell>
                      <TableCell>{item.unit_of_measure}</TableCell>
                      <TableCell>
                        {item._reservation ? (
                          <Badge variant="secondary">{item._reservation.quantity_remaining}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleSubmit(false)} disabled={isCreating}>
                  Save as unknown as Draft
                </Button>
                <Button onClick={() => handleSubmit(true)} disabled={isCreating}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Submit for Approval
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}