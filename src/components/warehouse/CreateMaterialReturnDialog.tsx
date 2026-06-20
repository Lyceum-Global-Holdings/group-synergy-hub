import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMaterialReturns } from "@/hooks/useMaterialReturns";
import { MaterialReturnNote } from "@/types/materialIssueReturn";
import { ItemSelector } from "@/components/common/ItemSelector";
import { SrnNumberField } from "@/components/warehouse/SrnNumberField";
import { SrnDocumentUploadField } from "@/components/warehouse/SrnDocumentUploadField";
import { MaterialAttachmentsPanel } from "@/components/warehouse/MaterialAttachmentsPanel";
import { BufferedAttachment, commitBufferedAttachments } from "@/hooks/useMaterialAttachments";
import { useCompany } from "@/contexts/CompanyContext";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBinsAtLocation } from "@/hooks/warehouse/useBinsAtLocation";

interface ReturnableLine {
  item_id: string;
  item_code: string;
  item_name: string;
  uom: string | null;
  qty_issued: number;
  qty_returned_prev: number;
  remaining: number;
  unit_cost: number;
  // editable
  quantity_returned: number;
  condition: 'good' | 'damaged' | 'expired';
  notes: string;
  bin_id: string | null;
  // metadata for UX hint
  default_bin_code?: string | null;
}

interface SupplierReturnItem {
  warehouse_item_id: string;
  item_code: string;
  item_name: string;
  quantity_returned: number;
  condition: 'good' | 'damaged' | 'expired';
  unit_cost: number;
  notes?: string;
  bin_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referenceId?: string;
  referenceType?: 'material_issue' | 'purchase_order' | 'other';
  // When provided, opens in edit mode for a draft MRN. Parent must guard
  // that status === 'draft'.
  editingDraft?: MaterialReturnNote | null;
}

export function CreateMaterialReturnDialog({ open, onOpenChange, referenceId, referenceType, editingDraft }: Props) {
  const isEditMode = !!editingDraft;
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const { createMaterialReturnWithItemsAsync, updateDraftWithItemsAsync, isCreating, isUpdatingDraft } = useMaterialReturns();

  const [returnDate, setReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [returnedBy, setReturnedBy] = useState('');
  const [returnType, setReturnType] = useState<'internal' | 'supplier'>(
    referenceType === 'purchase_order' ? 'supplier' : 'internal'
  );
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [srnNumber, setSrnNumber] = useState('');
  const [srnDocumentTempPath, setSrnDocumentTempPath] = useState<string>('');
  const [bufferedAttachments, setBufferedAttachments] = useState<BufferedAttachment[]>([]);

  // Internal return state
  const [selectedMinId, setSelectedMinId] = useState<string>(referenceId ?? '');
  const [lines, setLines] = useState<ReturnableLine[]>([]);
  const [locationId, setLocationId] = useState<string>(globalLocationId ?? '');

  // Supplier return state (free-form, existing behaviour)
  const [supplierItems, setSupplierItems] = useState<SupplierReturnItem[]>([]);

  // ---- Eligible MINs for current company/location ----
  const { data: eligibleMins = [], isLoading: loadingMins } = useQuery({
    queryKey: ['returnable-mins', selectedCompany?.id],
    enabled: !!selectedCompany?.id && open && returnType === 'internal',
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_issue_notes')
        .select('id, min_number, issue_date, issued_to, status, location_id')
        .eq('company_id', selectedCompany!.id)
        .in('status', ['approved', 'issued', 'partially_received', 'completed'])
        .order('issue_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Load issue lines + prior returns for selected MIN ----
  const {
    data: loadedLines,
    isFetching: loadingLines,
    error: linesError,
    refetch: refetchLines,
  } = useQuery({
    queryKey: ['min-returnable-lines', selectedMinId],
    enabled: !!selectedMinId && returnType === 'internal',
    staleTime: 0,
    retry: 1,
    queryFn: async (): Promise<ReturnableLine[]> => {
      const { data, error } = await supabase.rpc('get_min_returnable_lines', { p_min_id: selectedMinId });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        item_id: r.item_id,
        item_code: r.item_code ?? '',
        item_name: r.item_name ?? `Item ${String(r.item_id).slice(0, 8)}`,
        uom: r.unit_of_measure ?? null,
        qty_issued: Number(r.qty_issued || 0),
        qty_returned_prev: Number(r.qty_returned_prev || 0),
        remaining: Number(r.remaining || 0),
        unit_cost: Number(r.unit_cost || 0),
        quantity_returned: 0,
        condition: 'good' as const,
        notes: '',
        bin_id: null,
        default_bin_code: null,
      }));
    },
  });

  // Reset lines immediately when MIN selection changes — prevents stale rows
  // from a previous MIN from leaking into a new selection.
  useEffect(() => {
    setLines([]);
  }, [selectedMinId]);

  useEffect(() => {
    if (loadedLines) setLines(loadedLines);
  }, [loadedLines]);

  // Surface RPC error once per failure (toast). Inline Alert is rendered below.
  useEffect(() => {
    if (linesError) {
      toast.error(`Could not load issued items: ${(linesError as any)?.message ?? 'Unknown error'}`);
    }
  }, [linesError]);

  // Prefill returned_by and location from selected MIN
  useEffect(() => {
    if (!selectedMinId) return;
    const min = eligibleMins.find((m: any) => m.id === selectedMinId);
    if (min) {
      if (!returnedBy) setReturnedBy(min.issued_to ?? '');
      if (min.location_id) setLocationId(min.location_id);
    }
  }, [selectedMinId, eligibleMins]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Edit-mode hydration ---
  // When opened with an existing draft MRN, prefill header + lock the return
  // type / source MIN, then merge saved line items into the editable rows.
  useEffect(() => {
    if (!open || !editingDraft) return;
    setReturnDate(editingDraft.return_date ?? format(new Date(), 'yyyy-MM-dd'));
    setReturnedBy(editingDraft.returned_by ?? '');
    setReturnType((editingDraft.return_type as 'internal' | 'supplier') ?? 'internal');
    setReason(editingDraft.reason ?? '');
    setNotes(editingDraft.notes ?? '');
    setSrnNumber(editingDraft.srn_number ?? '');
    setLocationId(editingDraft.location_id ?? '');
    if (editingDraft.return_type === 'internal' && editingDraft.reference_type === 'material_issue') {
      setSelectedMinId(editingDraft.reference_id ?? '');
    }
  }, [open, editingDraft?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge saved draft items into the editable rows once both the source-MIN
  // RPC has resolved AND we have an edit target. We add the draft's own
  // previously-saved quantity back to `remaining`, because that quantity is
  // already counted in `qty_returned_prev` (the RPC sees draft items too).
  useEffect(() => {
    if (!open || !isEditMode || !editingDraft) return;
    if (editingDraft.return_type !== 'internal') return;
    if (!loadedLines || loadedLines.length === 0) return;
    (async () => {
      const { data, error } = await supabase
        .from('material_return_items')
        .select('item_id, quantity_returned, condition, unit_cost, notes, bin_id')
        .eq('mrn_id', editingDraft.id);
      if (error) {
        console.error('Failed to load draft return items', error);
        return;
      }
      const savedByItem = new Map(
        (data ?? []).map((r: any) => [r.item_id, r]),
      );
      setLines(
        loadedLines.map((l) => {
          const saved = savedByItem.get(l.item_id);
          const savedQty = Number(saved?.quantity_returned ?? 0);
          return {
            ...l,
            // restore editable cap to include the saved qty
            remaining: l.remaining + savedQty,
            quantity_returned: savedQty,
            condition: (saved?.condition as 'good' | 'damaged' | 'expired') ?? l.condition,
            notes: saved?.notes ?? l.notes,
            unit_cost: Number(saved?.unit_cost ?? l.unit_cost),
            bin_id: saved?.bin_id ?? l.bin_id ?? null,
          };
        }),
      );
    })();
  }, [open, isEditMode, editingDraft?.id, loadedLines]); // eslint-disable-line react-hooks/exhaustive-deps

  // Supplier-flow edit hydration
  useEffect(() => {
    if (!open || !isEditMode || !editingDraft) return;
    if (editingDraft.return_type !== 'supplier') return;
    (async () => {
      const { data, error } = await supabase
        .from('material_return_items')
        .select('item_id, quantity_returned, condition, unit_cost, notes, bin_id')
        .eq('mrn_id', editingDraft.id);
      if (error) {
        console.error('Failed to load draft supplier return items', error);
        return;
      }
      const itemIds = Array.from(new Set((data ?? []).map((r: any) => r.item_id).filter(Boolean)));
      let nameByItemId: Record<string, { item_code: string; name: string }> = {};
      if (itemIds.length) {
        const { data: wiRows } = await supabase
          .from('warehouse_items_full')
          .select('id, item_code, name')
          .in('id', itemIds);
        nameByItemId = Object.fromEntries(
          (wiRows ?? []).map((w: any) => [w.id, { item_code: w.item_code ?? '', name: w.name ?? '' }]),
        );
      }
      setSupplierItems(
        (data ?? []).map((r: any) => ({
          warehouse_item_id: r.item_id,
          item_code: nameByItemId[r.item_id]?.item_code ?? '',
          item_name: nameByItemId[r.item_id]?.name ?? '',
          quantity_returned: Number(r.quantity_returned ?? 0),
          condition: (r.condition as 'good' | 'damaged' | 'expired') ?? 'good',
          unit_cost: Number(r.unit_cost ?? 0),
          notes: r.notes ?? '',
          bin_id: r.bin_id ?? null,
        })),
      );
    })();
  }, [open, isEditMode, editingDraft?.id]); // eslint-disable-line react-hooks/exhaustive-deps



  // ---- User-accessible locations for the selected company (RLS scoped) ----
  const { data: accessibleLocations = [] } = useQuery({
    queryKey: ['user-accessible-locations', selectedCompany?.id],
    enabled: !!selectedCompany?.id && open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_locations')
        .select('id, name, location_code')
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resetAll = () => {
    setReturnDate(format(new Date(), 'yyyy-MM-dd'));
    setReturnedBy('');
    setReason('');
    setNotes('');
    setSrnNumber('');
    setSrnDocumentTempPath('');
    setSelectedMinId('');
    setLines([]);
    setSupplierItems([]);
    setLocationId(globalLocationId ?? '');
  };

  const updateLine = (idx: number, patch: Partial<ReturnableLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  // Supplier-flow helpers (preserved)
  const addSupplierItem = () =>
    setSupplierItems((p) => [
      ...p,
      { warehouse_item_id: '', item_code: '', item_name: '', quantity_returned: 0, condition: 'good', unit_cost: 0, notes: '', bin_id: null },
    ]);
  const removeSupplierItem = (i: number) => setSupplierItems((p) => p.filter((_, idx) => idx !== i));
  const patchSupplierItem = (i: number, patch: Partial<SupplierReturnItem>) =>
    setSupplierItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const internalValid = useMemo(() => {
    if (returnType !== 'internal') return true;
    if (!selectedMinId) return false;
    const withQty = lines.filter((l) => l.quantity_returned > 0);
    if (withQty.length === 0) return false;
    return withQty.every((l) => l.quantity_returned <= l.remaining);
  }, [returnType, selectedMinId, lines]);

  const supplierValid = useMemo(() => {
    if (returnType !== 'supplier') return true;
    return supplierItems.length > 0 && supplierItems.every((i) => i.warehouse_item_id && i.quantity_returned > 0);
  }, [returnType, supplierItems]);

  const canSubmit = !!selectedCompany?.id && !!returnedBy && !!reason && !!locationId && internalValid && supplierValid && !isCreating && !isUpdatingDraft && !loadingLines;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedCompany?.id) return;
    try {
      const isInternal = returnType === 'internal';
      const itemsPayload = isInternal
        ? lines
            .filter((l) => l.quantity_returned > 0)
            .map((l) => ({
              item_id: l.item_id,
              quantity_returned: l.quantity_returned,
              condition: l.condition,
              unit_cost: l.unit_cost,
              total_cost: l.quantity_returned * l.unit_cost,
              notes: l.notes || undefined,
            }))
        : supplierItems.map((i) => ({
            item_id: i.warehouse_item_id,
            quantity_returned: i.quantity_returned,
            condition: i.condition,
            unit_cost: i.unit_cost,
            total_cost: i.quantity_returned * i.unit_cost,
            notes: i.notes || undefined,
          }));

      let newReturn: MaterialReturnNote | null = null;

      if (isEditMode && editingDraft) {
        await updateDraftWithItemsAsync({
          id: editingDraft.id,
          header: {
            return_date: returnDate,
            returned_by: returnedBy,
            return_type: returnType,
            reason,
            reference_type: isInternal ? 'material_issue' : (referenceType ?? 'other'),
            reference_id: isInternal ? selectedMinId : referenceId || null,
            notes,
            location_id: locationId || null,
            srn_number: srnNumber || null,
          },
          items: itemsPayload,
        });
        newReturn = editingDraft;
      } else {
        newReturn = await createMaterialReturnWithItemsAsync({
          return_date: returnDate,
          returned_by: returnedBy,
          return_type: returnType,
          reason,
          reference_type: isInternal ? 'material_issue' : (referenceType ?? 'other'),
          reference_id: isInternal ? selectedMinId : referenceId || undefined,
          notes,
          company_id: selectedCompany.id,
          location_id: locationId || undefined,
          srn_number: srnNumber || undefined,
          items: itemsPayload,
        });
      }


      if (srnDocumentTempPath && newReturn?.id) {
        try {
          const ext = srnDocumentTempPath.split('.').pop() ?? 'bin';
          const finalPath = `${selectedCompany.id}/${newReturn.id}/srn_${Date.now()}.${ext}`;
          const { error: moveErr } = await supabase.storage
            .from('min-srn-documents')
            .move(srnDocumentTempPath, finalPath);
          await supabase
            .from('material_return_notes')
            .update({ srn_document_url: moveErr ? srnDocumentTempPath : finalPath })
            .eq('id', newReturn.id);
        } catch (e) {
          console.error('Failed to attach SRN document', e);
        }
      }

      if (bufferedAttachments.length && newReturn?.id && selectedCompany?.id) {
        try {
          await commitBufferedAttachments(
            'material_return',
            newReturn.id,
            selectedCompany.id,
            bufferedAttachments,
          );
          setBufferedAttachments([]);
        } catch (e) {
          console.error('Failed to attach extra files to MRN', e);
        }
      }
      resetAll();
      onOpenChange(false);
    } catch (e: any) {
      console.error('Error creating material return:', e);
      toast.error(e?.message ?? 'Failed to create material return');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isEditMode) resetAll(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode
              ? `Edit Draft — ${editingDraft?.mrn_number ?? 'MRN'}`
              : 'Create Material Return Note'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Return Type</Label>
              <Select
                value={returnType}
                onValueChange={(v: any) => { setReturnType(v); setLines([]); setSelectedMinId(''); }}
                disabled={isEditMode}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal Return (from MIN)</SelectItem>
                  <SelectItem value="supplier">Supplier Return</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Return Date</Label>
              <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </div>
          </div>

          {returnType === 'internal' && (
            <div>
              <Label>Source Material Issue Note (MIN) *</Label>
              <Select value={selectedMinId} onValueChange={setSelectedMinId} disabled={loadingMins || isEditMode}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingMins ? 'Loading…' : 'Select a MIN to return against'} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {eligibleMins.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.min_number} · {m.issue_date} · {m.issued_to}
                    </SelectItem>
                  ))}
                  {eligibleMins.length === 0 && !loadingMins && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No approved/issued MINs found</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}


          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Returned By *</Label>
              <Input value={returnedBy} onChange={(e) => setReturnedBy(e.target.value)} placeholder="Name of person returning" />
            </div>
            <div>
              <Label>Location *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select the warehouse / site location" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {accessibleLocations.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.location_code ? `${l.location_code} · ` : ''}{l.name}
                    </SelectItem>
                  ))}
                  {accessibleLocations.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No locations available</div>
                  )}
                </SelectContent>
              </Select>
              {returnType === 'internal' && selectedMinId && (
                <p className="text-xs text-muted-foreground mt-1">Auto-filled from the selected MIN; change only if needed.</p>
              )}
            </div>
          </div>

          <SrnNumberField value={srnNumber} onChange={setSrnNumber} />
          <SrnDocumentUploadField
            companyId={selectedCompany?.id}
            currentDocumentUrl={srnDocumentTempPath}
            onUpload={setSrnDocumentTempPath}
          />

          <MaterialAttachmentsPanel
            parentType="material_return"
            companyId={selectedCompany?.id}
            label="Additional Attachments"
            buffered={bufferedAttachments}
            onBufferedChange={setBufferedAttachments}
          />

          <div>
            <Label>Reason for Return *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why are these items being returned?" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Additional notes" />
          </div>

          {/* Internal return: items table loaded from MIN */}
          {returnType === 'internal' && (
            <div className="space-y-2">
              <Label>Return Items</Label>
              {loadingLines ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading issued items…
                </div>
              ) : linesError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Could not load issued items</AlertTitle>
                  <AlertDescription className="flex items-center justify-between gap-3">
                    <span className="text-xs">{(linesError as any)?.message ?? 'Unknown error'}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => refetchLines()}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : !selectedMinId ? (
                <p className="text-sm text-muted-foreground border rounded p-4">Select a MIN above to load its items.</p>
              ) : lines.length === 0 ? (
                <p className="text-sm text-muted-foreground border rounded p-4">This MIN has no issued items to return.</p>
              ) : lines.every((l) => l.remaining <= 0) ? (
                <p className="text-sm text-muted-foreground border rounded p-4">All items from this MIN have already been returned.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Issued</TableHead>
                        <TableHead className="text-right">Already Returned</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="w-32">Qty to Return</TableHead>
                        <TableHead className="w-32">Condition</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((l, idx) => {
                        const over = l.quantity_returned > l.remaining;
                        return (
                          <TableRow key={l.item_id}>
                            <TableCell className="font-mono text-xs">{l.item_code}</TableCell>
                            <TableCell>{l.item_name}</TableCell>
                            <TableCell className="text-right">{l.qty_issued} {l.uom ?? ''}</TableCell>
                            <TableCell className="text-right">{l.qty_returned_prev}</TableCell>
                            <TableCell className="text-right font-medium">{l.remaining}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={l.remaining}
                                step="0.01"
                                value={l.quantity_returned || ''}
                                onChange={(e) =>
                                  updateLine(idx, { quantity_returned: Math.max(0, parseFloat(e.target.value) || 0) })
                                }
                                className={over ? 'border-destructive' : ''}
                                disabled={l.remaining <= 0}
                              />
                            </TableCell>
                            <TableCell>
                              <Select value={l.condition} onValueChange={(v: any) => updateLine(idx, { condition: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="good">Good</SelectItem>
                                  <SelectItem value="damaged">Damaged</SelectItem>
                                  <SelectItem value="expired">Expired</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">{l.unit_cost.toFixed(2)}</TableCell>
                            <TableCell>
                              <Input value={l.notes} onChange={(e) => updateLine(idx, { notes: e.target.value })} placeholder="Optional" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* Supplier return: free-form items (unchanged behaviour) */}
          {returnType === 'supplier' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Return Items</Label>
                <Button onClick={addSupplierItem} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </div>
              {supplierItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 space-y-3">
                      <ItemSelector
                        value={item.warehouse_item_id}
                        onSelect={(s) =>
                          patchSupplierItem(index, {
                            warehouse_item_id: s.id,
                            item_code: s.item_code,
                            item_name: s.name,
                            unit_cost: s.unit_cost || 0,
                          })
                        }
                      />
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number" min={0} step="0.01"
                            value={item.quantity_returned}
                            onChange={(e) => patchSupplierItem(index, { quantity_returned: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label>Condition</Label>
                          <Select value={item.condition} onValueChange={(v: any) => patchSupplierItem(index, { condition: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="good">Good</SelectItem>
                              <SelectItem value="damaged">Damaged</SelectItem>
                              <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Unit Cost</Label>
                          <Input
                            type="number" min={0} step="0.01"
                            value={item.unit_cost}
                            onChange={(e) => patchSupplierItem(index, { unit_cost: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Notes</Label>
                        <Input value={item.notes || ''} onChange={(e) => patchSupplierItem(index, { notes: e.target.value })} />
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeSupplierItem(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Returns are saved as <strong>drafts</strong> and have no stock impact until an admin approves them.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {(isCreating || isUpdatingDraft)
                  ? 'Saving…'
                  : isEditMode ? 'Save Changes' : 'Save as Draft'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
