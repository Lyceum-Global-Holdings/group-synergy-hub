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
import { useMaterialReturnItems } from "@/hooks/useMaterialReturnItems";
import { ItemSelector } from "@/components/common/ItemSelector";
import { SrnNumberField } from "@/components/warehouse/SrnNumberField";
import { SrnDocumentUploadField } from "@/components/warehouse/SrnDocumentUploadField";
import { MaterialAttachmentsPanel } from "@/components/warehouse/MaterialAttachmentsPanel";
import { BufferedAttachment, commitBufferedAttachments } from "@/hooks/useMaterialAttachments";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

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
}

interface SupplierReturnItem {
  warehouse_item_id: string;
  item_code: string;
  item_name: string;
  quantity_returned: number;
  condition: 'good' | 'damaged' | 'expired';
  unit_cost: number;
  notes?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referenceId?: string;
  referenceType?: 'material_issue' | 'purchase_order' | 'other';
}

export function CreateMaterialReturnDialog({ open, onOpenChange, referenceId, referenceType }: Props) {
  const { selectedCompany } = useCompany();
  const { createMaterialReturnAsync, isCreating } = useMaterialReturns();
  const { createItems } = useMaterialReturnItems();

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
        .select('id, min_number, issue_date, issued_to, status')
        .eq('company_id', selectedCompany!.id)
        .in('status', ['approved', 'issued', 'partially_received', 'completed'])
        .order('issue_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Load issue lines + prior returns for selected MIN ----
  const { data: loadedLines, isFetching: loadingLines } = useQuery({
    queryKey: ['min-returnable-lines', selectedMinId],
    enabled: !!selectedMinId && returnType === 'internal',
    staleTime: 0,
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
      }));
    },
  });

  useEffect(() => {
    if (loadedLines) setLines(loadedLines);
  }, [loadedLines]);

  // Prefill returned_by from selected MIN
  useEffect(() => {
    if (!selectedMinId) return;
    const min = eligibleMins.find((m: any) => m.id === selectedMinId);
    if (min && !returnedBy) setReturnedBy(min.issued_to ?? '');
  }, [selectedMinId, eligibleMins]); // eslint-disable-line react-hooks/exhaustive-deps

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
  };

  const updateLine = (idx: number, patch: Partial<ReturnableLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  // Supplier-flow helpers (preserved)
  const addSupplierItem = () =>
    setSupplierItems((p) => [
      ...p,
      { warehouse_item_id: '', item_code: '', item_name: '', quantity_returned: 0, condition: 'good', unit_cost: 0, notes: '' },
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

  const canSubmit = !!selectedCompany?.id && !!returnedBy && !!reason && internalValid && supplierValid && !isCreating;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedCompany?.id) return;
    try {
      const isInternal = returnType === 'internal';
      const newReturn = await createMaterialReturnAsync({
        return_date: returnDate,
        returned_by: returnedBy,
        return_type: returnType,
        reason,
        reference_type: isInternal ? 'material_issue' : (referenceType ?? 'other'),
        reference_id: isInternal ? selectedMinId : referenceId || undefined,
        notes,
        company_id: selectedCompany.id,
        srn_number: srnNumber || undefined,
      });

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

      const payload = isInternal
        ? lines
            .filter((l) => l.quantity_returned > 0)
            .map((l) => ({
              mrn_id: newReturn.id,
              item_id: l.item_id,
              quantity_returned: l.quantity_returned,
              condition: l.condition,
              unit_cost: l.unit_cost,
              total_cost: l.quantity_returned * l.unit_cost,
              notes: l.notes || null,
            }))
        : supplierItems.map((i) => ({
            mrn_id: newReturn.id,
            item_id: i.warehouse_item_id,
            quantity_returned: i.quantity_returned,
            condition: i.condition,
            unit_cost: i.unit_cost,
            total_cost: i.quantity_returned * i.unit_cost,
            notes: i.notes || null,
          }));

      await createItems(payload);
      resetAll();
      onOpenChange(false);
    } catch (e: any) {
      console.error('Error creating material return:', e);
      toast.error(e?.message ?? 'Failed to create material return');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAll(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Material Return Note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Return Type</Label>
              <Select value={returnType} onValueChange={(v: any) => { setReturnType(v); setLines([]); setSelectedMinId(''); }}>
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
              <Select value={selectedMinId} onValueChange={setSelectedMinId} disabled={loadingMins}>
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
              ) : !selectedMinId ? (
                <p className="text-sm text-muted-foreground border rounded p-4">Select a MIN above to load its items.</p>
              ) : lines.length === 0 ? (
                <p className="text-sm text-muted-foreground border rounded p-4">This MIN has no returnable items.</p>
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

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isCreating ? 'Creating…' : 'Create Return'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
