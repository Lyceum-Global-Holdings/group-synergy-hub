import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2, Package, CalendarDays, Hash, Check, ChevronsUpDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useCompany } from '@/contexts/CompanyContext';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useCreateGoodsReceiptNote, useUpdateDraftGrnWithItems } from '@/hooks/useGoodsReceiptNotes';
import { useWarehouseCatalogPage } from '@/hooks/useWarehouseCatalogPage';
import { useGenerateBatchNumber, BATCH_NUMBER_REGEX } from '@/hooks/useGenerateBatchNumber';
import { toast } from 'sonner';
import { CreateGrnItemData, QualityStatus } from '@/types/grn';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { InvoiceUploadField } from './InvoiceUploadField';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  grn_date: z.string(),
  po_id: z.string().optional(),
  supplier_name: z.string().optional(),
  supplier_address: z.string().optional(),
  invoice_number: z.string().optional(),
  invoice_date: z.string().optional(),
  remarks: z.string().optional(),
});

// Net line value after the per-line discount (gross − capped discount).
const grnLineNet = (it: CreateGrnItemData): number => {
  const gross = (Number(it.quantity_received) || 0) * (Number(it.unit_price) || 0);
  const v = Number(it.discount_value) || 0;
  const d = it.discount_type === 'percent' ? (gross * v) / 100 : it.discount_type === 'fixed' ? v : 0;
  return Math.max(0, gross - Math.min(Math.max(d, 0), gross));
};

interface CreateGrnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId?: string;
  // When provided, the dialog opens in edit mode for a draft GRN.
  // The parent must only pass GRNs whose status === 'draft'.
  editingDraft?: (import('@/types/grn').GoodsReceiptNote & { grn_items?: import('@/types/grn').GrnItem[] }) | null;
}

export function CreateGrnDialog({ open, onOpenChange, poId, editingDraft }: CreateGrnDialogProps) {
  const isEditMode = !!editingDraft;
  const { selectedCompany } = useCompany();
  const { data: pos = [] } = usePurchaseOrders();
  const createGrn = useCreateGoodsReceiptNote();
  const updateDraftGrn = useUpdateDraftGrnWithItems();
  const [overallDiscType, setOverallDiscType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [overallDiscValue, setOverallDiscValue] = useState<number>(0);
  const [taxType, setTaxType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [taxValue, setTaxValue] = useState<number>(0);
  const generateBatch = useGenerateBatchNumber();

  const [items, setItems] = useState<CreateGrnItemData[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>(poId || '');
  const [invoiceDocumentUrl, setInvoiceDocumentUrl] = useState<string>('');
  const [itemComboboxOpen, setItemComboboxOpen] = useState<number | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [debouncedItemSearch, setDebouncedItemSearch] = useState('');

  // Tracks whether we've already hydrated the form from `editingDraft` for the
  // current dialog opening. Lets us skip the PO auto-loader on the first run
  // (it would clobber the saved line items with PO defaults).
  const editHydratedRef = useRef(false);

  // Hydrate from editingDraft when the dialog opens
  useEffect(() => {
    if (!open) {
      editHydratedRef.current = false;
      return;
    }
    if (!editingDraft) return;
    editHydratedRef.current = true;
    form.reset({
      grn_date: editingDraft.grn_date,
      po_id: editingDraft.po_id || '',
      supplier_name: editingDraft.supplier_name || '',
      supplier_address: editingDraft.supplier_address || '',
      invoice_number: editingDraft.invoice_number || '',
      invoice_date: editingDraft.invoice_date || '',
      remarks: editingDraft.remarks || '',
    });
    setSelectedPoId(editingDraft.po_id || '');
    setInvoiceDocumentUrl(editingDraft.invoice_document_url || '');
    setOverallDiscType((editingDraft.discount_type as any) || 'none');
    setOverallDiscValue(Number(editingDraft.discount_value) || 0);
    setTaxType((editingDraft.tax_type as any) || 'none');
    setTaxValue(Number(editingDraft.tax_value) || 0);
    const hydratedItems: CreateGrnItemData[] = (editingDraft.grn_items || []).map((row: any) => ({
      po_item_id: row.po_item_id ?? undefined,
      warehouse_item_id: row.warehouse_item_id ?? undefined,
      catalog_item_id: row.catalog_item_id ?? undefined,
      item_code: row.item_code ?? undefined,
      item_name: row.item_name ?? '',
      description: row.description ?? undefined,
      unit_of_measure: row.unit_of_measure ?? 'pcs',
      quantity_ordered: row.quantity_ordered ?? undefined,
      quantity_already_received: 0,
      quantity_pending_approval: 0,
      quantity_received: Number(row.quantity_received ?? 0),
      unit_price: Number(row.unit_price ?? 0),
      total_cost: Number(row.total_cost ?? 0),
      discount_type: row.discount_type ?? null,
      discount_value: Number(row.discount_value ?? 0),
      quality_status: (row.quality_status ?? 'good') as QualityStatus,
      remarks: row.remarks ?? undefined,
      batch_number: row.batch_number ?? '',
      manufacturing_date: row.manufacturing_date ?? '',
      expiry_date: row.expiry_date ?? '',
      serial_numbers: [],
      is_batch_tracked: !!row.batch_number,
      is_serialized: false,
      track_secondary_quantity: !!row.secondary_uom,
      secondary_uom: row.secondary_uom ?? '',
      secondary_quantity_received: row.secondary_quantity_received ?? 0,
      conversion_note: row.conversion_note ?? undefined,
    }));
    setItems(hydratedItems);
  }, [open, editingDraft?.id]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    const t = setTimeout(() => setDebouncedItemSearch(itemSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [itemSearch]);

  const {
    data: catalogPages,
    fetchNextPage,
    hasNextPage,
    isFetching: isFetchingCatalog,
    isFetchingNextPage,
  } = useWarehouseCatalogPage({
    search: debouncedItemSearch || undefined,
    status: 'active',
    pageSize: 50,
    enabled: open,
  });
  const warehouseItems = (catalogPages?.pages ?? []).flat();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      grn_date: format(new Date(), 'yyyy-MM-dd'),
      po_id: poId || '',
    },
  });

  // Filter POs that are approved, sent, or partially received with pending quantities
  const availablePOs = pos.filter((po) => {
    // Include POs that are approved, sent, or partially received
    const validStatus = ['approved', 'sent', 'partially_received'].includes(po.status);
    
    // Check if PO has items
    if (!validStatus || !po.items?.length) return false;
    
    // Check if any item has pending quantity
    const hasPendingItems = po.items.some(
      (item: any) => (item.quantity_received || 0) < item.quantity_ordered
    );
    
    return hasPendingItems;
  });

  // Load PO items when PO is selected
  useEffect(() => {
    const loadPoWithPendingQuantities = async () => {
      if (!selectedPoId) return;
      // In edit mode, skip the auto-loader on the initial render so it doesn't
      // overwrite the saved draft items with PO defaults. User-driven PO
      // changes after hydration still load normally.
      if (isEditMode && editingDraft?.po_id === selectedPoId) return;


      
      const selectedPo = pos.find((po) => po.id === selectedPoId);
      if (!selectedPo) return;

      form.setValue('supplier_name', selectedPo.supplier?.name || '');
      form.setValue('supplier_address', 'Address not available');

      // Fetch pending quantities from draft/submitted GRNs
      const poItemIds = selectedPo.items?.map((item: any) => item.id) || [];
      
      const { data: pendingGrnItems } = await supabase
        .from("grn_items")
        .select(`
          po_item_id,
          quantity_received,
          goods_receipt_notes!inner(status)
        `)
        .in("goods_receipt_notes.status", ["draft", "submitted"])
        .in("po_item_id", poItemIds);

      // Aggregate pending quantities by po_item_id
      const pendingQuantities = pendingGrnItems?.reduce((acc, item) => {
        if (!item.po_item_id) return acc;
        acc[item.po_item_id] = (acc[item.po_item_id] || 0) + (item.quantity_received || 0);
        return acc;
      }, {} as Record<string, number>) || {};

      // Fetch warehouse item tracking flags
      const warehouseItemIds = selectedPo.items
        ?.filter((item: any) => item.warehouse_item_id)
        .map((item: any) => item.warehouse_item_id) || [];
      
      let trackingFlags: Record<string, { is_batch_tracked: boolean; is_serialized: boolean; track_secondary_quantity: boolean; secondary_uom: string | null }> = {};
      if (warehouseItemIds.length > 0) {
        const { data: warehouseItems } = await supabase
          .from('warehouse_items_full')
          .select('id, is_batch_tracked, is_serialized, track_secondary_quantity, secondary_uom')
          .in('id', warehouseItemIds);

        trackingFlags = (warehouseItems || []).reduce((acc, item: any) => {
          acc[item.id] = {
            is_batch_tracked: item.is_batch_tracked || false,
            is_serialized: item.is_serialized || false,
            track_secondary_quantity: item.track_secondary_quantity || false,
            secondary_uom: item.secondary_uom || null,
          };
          return acc;
        }, {} as Record<string, { is_batch_tracked: boolean; is_serialized: boolean; track_secondary_quantity: boolean; secondary_uom: string | null }>);
      }

      const poItems: CreateGrnItemData[] =
        selectedPo.items?.map((item: any) => {
          const flags = item.warehouse_item_id ? trackingFlags[item.warehouse_item_id] : null;
          return {
            po_item_id: item.id,
            warehouse_item_id: item.warehouse_item_id,
            item_code: item.item_code,
            item_name: item.item_name,
            description: item.description,
            unit_of_measure: item.unit_of_measure,
            quantity_ordered: item.quantity_ordered,
            quantity_already_received: item.quantity_received || 0,
            quantity_pending_approval: pendingQuantities[item.id] || 0,
            quantity_received: 0,
            unit_price: item.unit_price,
            total_cost: 0,
            quality_status: 'good' as QualityStatus,
            // Batch/Serial tracking
            is_batch_tracked: flags?.is_batch_tracked || false,
            is_serialized: flags?.is_serialized || false,
            batch_number: '',
            expiry_date: '',
            manufacturing_date: '',
            serial_numbers: [],
            // Dual quantity tracking
            track_secondary_quantity: flags?.track_secondary_quantity || false,
            secondary_uom: flags?.secondary_uom || '',
            secondary_quantity_received: 0,
          };
        }) || [];

      setItems(poItems);

      // Auto-generate batch numbers for batch-tracked items
      if (selectedCompany?.id) {
        const updates = await Promise.all(
          poItems.map(async (it) => {
            if (it.is_batch_tracked && it.warehouse_item_id) {
              try {
                const code = await generateBatch.mutateAsync({
                  companyId: selectedCompany.id,
                  warehouseItemId: it.warehouse_item_id,
                });
                return { ...it, batch_number: code };
              } catch {
                return it;
              }
            }
            return it;
          })
        );
        setItems(updates);
      }
    };

    loadPoWithPendingQuantities();
  }, [selectedPoId, pos, form]);

  const handleAddManualItem = () => {
    setItems([
      ...items,
      {
        item_name: '',
        unit_of_measure: 'pcs',
        quantity_received: 0,
        unit_price: 0,
        total_cost: 0,
        quality_status: 'good',
        is_batch_tracked: false,
        is_serialized: false,
        batch_number: '',
        expiry_date: '',
        manufacturing_date: '',
        serial_numbers: [],
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof CreateGrnItemData,
    value: any
  ) => {
    const newItems = [...items];
    const item = newItems[index];

    // Validation for quantity_received
    if (field === 'quantity_received' && item.quantity_ordered) {
      const qtyRemaining = item.quantity_ordered - (item.quantity_already_received || 0) - (item.quantity_pending_approval || 0);
      
      if (value > qtyRemaining) {
        alert(`Cannot receive ${value} units. Only ${qtyRemaining} units remaining for this item.`);
        return; // Don't update if validation fails
      }
    }

    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-fill item details when warehouse item is selected
    if (field === 'warehouse_item_id') {
      const selectedItem = warehouseItems.find(wi => wi.id === value);
      if (selectedItem) {
        newItems[index].item_name = selectedItem.name;
        newItems[index].is_batch_tracked = selectedItem.is_batch_tracked || false;
        newItems[index].is_serialized = selectedItem.is_serialized || false;
        newItems[index].track_secondary_quantity = (selectedItem as any).track_secondary_quantity || false;
        newItems[index].secondary_uom = (selectedItem as any).secondary_uom || '';
        if (selectedItem.unit_cost) {
          newItems[index].unit_price = Number(selectedItem.unit_cost);
        }
        // Auto-generate batch number for batch-tracked items
        if (selectedItem.is_batch_tracked && selectedCompany?.id && !newItems[index].batch_number) {
          generateBatch
            .mutateAsync({ companyId: selectedCompany.id, warehouseItemId: value })
            .then((code) => handleItemChange(index, 'batch_number', code))
            .catch(() => { /* user can click Gen to retry */ });
        }
      }
    }

    // Auto-calculate net line total (gross − per-line discount).
    if (['quantity_received', 'unit_price', 'discount_type', 'discount_value'].includes(field)) {
      newItems[index].total_cost = grnLineNet(newItems[index]);
    }

    setItems(newItems);
  };

  const getItemStatus = (item: CreateGrnItemData): { label: string; variant: 'default' | 'secondary' | 'destructive' } => {
    if (!item.quantity_ordered) return { label: 'Manual', variant: 'secondary' };
    
    const totalReceived = (item.quantity_already_received || 0) + (item.quantity_pending_approval || 0);
    const remaining = item.quantity_ordered - totalReceived;
    
    if (remaining === 0) return { label: 'Complete', variant: 'default' };
    if (totalReceived > 0) return { label: 'Partial', variant: 'secondary' };
    return { label: 'Pending', variant: 'secondary' };
  };

  // GS1 AI(10) compatible batch/lot code, generated server-side for uniqueness.
  const fillBatchNumber = async (index: number) => {
    const item = items[index];
    if (!selectedCompany?.id || !item?.warehouse_item_id) {
      toast.error('Select a warehouse item before generating a batch number');
      return;
    }
    try {
      const code = await generateBatch.mutateAsync({
        companyId: selectedCompany.id,
        warehouseItemId: item.warehouse_item_id,
      });
      handleItemChange(index, 'batch_number', code);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate batch number');
    }
  };


  const handleSubmit = async (status: 'draft' | 'submitted') => {
    const values = form.getValues();

    // Filter items with quantity > 0
    const validItems = items.filter((item) => item.quantity_received > 0);

    if (validItems.length === 0) {
      alert('Please add at least one item with quantity received > 0');
      return;
    }

    // Validate batch-tracked items have batch numbers
    const missingBatch = validItems.filter(
      (item) => item.is_batch_tracked && !item.batch_number?.trim()
    );
    if (missingBatch.length > 0) {
      const names = missingBatch.map((i) => i.item_name).join(', ');
      alert(`Batch number is required for batch-tracked items: ${names}`);
      return;
    }

    // Validate batch number format (GS1 AI(10) — up to 20 chars [A-Z0-9./-])
    const badBatch = validItems.filter(
      (item) => item.is_batch_tracked && item.batch_number && !BATCH_NUMBER_REGEX.test(item.batch_number.trim())
    );
    if (badBatch.length > 0) {
      const names = badBatch.map((i) => `${i.item_name} (${i.batch_number})`).join(', ');
      alert(`Invalid batch number format. Use up to 20 characters from A-Z, 0-9, '.', '/', '-': ${names}`);
      return;
    }
    const missingDates = validItems.filter(
      (item) => item.is_batch_tracked && (!item.manufacturing_date || !item.expiry_date)
    );
    if (missingDates.length > 0) {
      const names = missingDates.map((i) => i.item_name).join(', ');
      const proceed = window.confirm(
        `Manufacturing/Expiry dates are missing for: ${names}.\n\nPer GMP standards, these dates should be recorded. Continue anyway?`
      );
      if (!proceed) return;
    }

    const headerPayload = {
      grn_date: values.grn_date || format(new Date(), 'yyyy-MM-dd'),
      po_id: selectedPoId || undefined,
      po_number: pos.find((po) => po.id === selectedPoId)?.po_number,
      supplier_name: values.supplier_name,
      supplier_address: values.supplier_address,
      invoice_number: values.invoice_number || undefined,
      invoice_date: values.invoice_date || undefined,
      invoice_document_url: invoiceDocumentUrl || undefined,
      remarks: values.remarks || undefined,
      discount_type: overallDiscType === 'none' ? null : overallDiscType,
      discount_value: overallDiscType === 'none' ? 0 : (Number(overallDiscValue) || 0),
      tax_type: taxType === 'none' ? null : taxType,
      tax_value: taxType === 'none' ? 0 : (Number(taxValue) || 0),
      company_id: selectedCompany?.id,
    };

    if (isEditMode && editingDraft) {
      await updateDraftGrn.mutateAsync({
        id: editingDraft.id,
        header: { ...headerPayload, status: 'draft' },
        items: validItems,
        submit: status === 'submitted',
      });
    } else {
      await createGrn.mutateAsync({
        ...headerPayload,
        status,
        items: validItems,
      });
    }

    onOpenChange(false);
    form.reset();
    setItems([]);
    setOverallDiscType('none');
    setOverallDiscValue(0);
    setTaxType('none');
    setTaxValue(0);
    setSelectedPoId('');
    setInvoiceDocumentUrl('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-7xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>
            {isEditMode
              ? `Edit Draft — ${editingDraft?.grn_number ?? 'GRN'}`
              : 'Create Goods Receipt Note'}
          </DialogTitle>
        </DialogHeader>


        <div className="space-y-4 overflow-y-auto px-6 py-4 flex-1 min-h-0">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>GRN Date</Label>
              <Input
                type="date"
                {...form.register('grn_date')}
              />
            </div>

            <div>
              <Label>Select Purchase Order (Optional)</Label>
              <Select value={selectedPoId} onValueChange={setSelectedPoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select PO or create manual GRN" />
                </SelectTrigger>
                <SelectContent>
                  {availablePOs.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number} - {po.supplier?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!selectedPoId && (
              <>
                <div>
                  <Label>Supplier Name</Label>
                  <Input {...form.register('supplier_name')} />
                </div>
                <div>
                  <Label>Supplier Address</Label>
                  <Input {...form.register('supplier_address')} />
                </div>
              </>
            )}

            <div>
              <Label>Invoice Number (Optional)</Label>
              <Input {...form.register('invoice_number')} />
            </div>

            <div>
              <Label>Invoice Date (Optional)</Label>
              <Input type="date" {...form.register('invoice_date')} />
            </div>
          </div>

          {/* Invoice Upload */}
          <div>
            <InvoiceUploadField
              currentDocumentUrl={invoiceDocumentUrl}
              onUpload={(url) => setInvoiceDocumentUrl(url)}
              label="Upload Invoice Document (Optional)"
            />
          </div>

          {/* Items Table */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddManualItem}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[1280px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>Qty Ordered</TableHead>
                  <TableHead>Qty Remaining</TableHead>
                  <TableHead>Qty Receiving</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Quality</TableHead>
                   <TableHead>Batch/Serial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {item.po_item_id ? (
                        <div className="flex flex-col">
                          <span>{item.item_name}</span>
                          {(item.is_batch_tracked || item.is_serialized) && (
                            <div className="flex gap-1 mt-1">
                              {item.is_batch_tracked && (
                                <Badge variant="outline" className="text-xs">
                                  <Package className="h-3 w-3 mr-1" />
                                  Batch
                                </Badge>
                              )}
                              {item.is_serialized && (
                                <Badge variant="outline" className="text-xs">
                                  <Hash className="h-3 w-3 mr-1" />
                                  Serial
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <Popover 
                            open={itemComboboxOpen === index} 
                            onOpenChange={(open) => setItemComboboxOpen(open ? index : null)}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={itemComboboxOpen === index}
                                className="w-[180px] justify-between h-9 font-normal"
                              >
                                <span className="truncate">
                                  {item.item_name || "Select or type item..."}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[320px] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Search by name or code..."
                                  value={itemSearch}
                                  onValueChange={(value) => {
                                    setItemSearch(value);
                                  }}
                                />
                                <CommandList
                                  onScroll={(e) => {
                                    const el = e.currentTarget;
                                    if (
                                      hasNextPage &&
                                      !isFetchingNextPage &&
                                      el.scrollHeight - el.scrollTop - el.clientHeight < 80
                                    ) {
                                      fetchNextPage();
                                    }
                                  }}
                                >
                                  <CommandEmpty>
                                    <div className="py-2 px-3 text-sm text-muted-foreground">
                                      {isFetchingCatalog
                                        ? 'Searching…'
                                        : 'No items found. Refine your search or add the item in the catalog first.'}
                                    </div>
                                  </CommandEmpty>
                                  <CommandGroup heading="Item Master">
                                    {warehouseItems.map((wi) => (
                                        <CommandItem
                                          key={wi.id}
                                          value={wi.id}
                                          onSelect={async () => {
                                            setItemComboboxOpen(null);
                                            if (!selectedCompany?.id) {
                                              toast.error('Select a company first');
                                              return;
                                            }
                                            try {
                                              // ISO 9001 §8.6 GR-blocked stock: do NOT provision a
                                              // per-company warehouse_items row here. Just link the
                                              // catalog item. Inventory rows are created atomically
                                              // inside approve_grn_with_allocations on approval.
                                              const { data: existing } = await supabase
                                                .from('warehouse_items')
                                                .select('id')
                                                .eq('company_id', selectedCompany.id)
                                                .eq('catalog_item_id', wi.id)
                                                .maybeSingle();
                                              const warehouseItemId = existing?.id ?? undefined;

                                              const newItems = [...items];
                                              newItems[index] = {
                                                ...newItems[index],
                                                warehouse_item_id: warehouseItemId,
                                                catalog_item_id: wi.id,
                                                item_name: wi.name,
                                                item_code: wi.item_code,
                                                is_batch_tracked: (wi as any).is_batch_tracked || false,
                                                is_serialized: (wi as any).is_serialized || false,
                                                track_secondary_quantity: (wi as any).track_secondary_quantity || false,
                                                secondary_uom: (wi as any).secondary_uom || '',
                                                unit_price: (wi as any).unit_cost ? Number((wi as any).unit_cost) : newItems[index].unit_price,
                                              };
                                              const qty = newItems[index].quantity_received || 0;
                                              const price = newItems[index].unit_price || 0;
                                              newItems[index].total_cost = qty * price;
                                              setItems(newItems);
                                              setItemSearch('');
                                              // Auto-generate batch number only if a per-company
                                              // inventory row already exists. Otherwise the batch
                                              // number is assigned at approval time.
                                              if ((wi as any).is_batch_tracked && !newItems[index].batch_number && warehouseItemId) {
                                                try {
                                                  const code = await generateBatch.mutateAsync({
                                                    companyId: selectedCompany.id,
                                                    warehouseItemId,
                                                  });
                                                  handleItemChange(index, 'batch_number', code);
                                                } catch {
                                                  /* user can click Gen to retry */
                                                }
                                              }
                                            } catch (err: any) {
                                              toast.error(err?.message || 'Failed to link item');
                                            }
                                          }}

                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              item.warehouse_item_id === wi.id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex flex-col">
                                            <span>{wi.name}</span>
                                            <span className="text-xs text-muted-foreground">{wi.item_code}</span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    {(isFetchingCatalog || isFetchingNextPage) && (
                                      <div className="py-2 px-3 text-xs text-muted-foreground">Loading…</div>
                                    )}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {(item.is_batch_tracked || item.is_serialized) && (
                            <div className="flex gap-1">
                              {item.is_batch_tracked && (
                                <Badge variant="outline" className="text-xs">
                                  <Package className="h-3 w-3 mr-1" />
                                  Batch
                                </Badge>
                              )}
                              {item.is_serialized && (
                                <Badge variant="outline" className="text-xs">
                                  <Hash className="h-3 w-3 mr-1" />
                                  Serial
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{item.unit_of_measure}</TableCell>
                    <TableCell>{item.quantity_ordered || '-'}</TableCell>
                    <TableCell>
                      {item.quantity_ordered ? (
                        (() => {
                          const remaining = item.quantity_ordered - (item.quantity_already_received || 0) - (item.quantity_pending_approval || 0);
                          return (
                            <span className={
                              remaining === 0 ? 'text-green-600 font-semibold' :
                              remaining < 0 ? 'text-destructive font-semibold flex items-center gap-1' :
                              'text-muted-foreground'
                            }>
                              {remaining < 0 && <AlertCircle className="h-4 w-4" />}
                              {remaining}
                            </span>
                          );
                        })()
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        inputMode="decimal"
                        value={item.quantity_received}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            'quantity_received',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24"
                      />
                      {item.track_secondary_quantity && (
                        <div className="mt-1">
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            inputMode="decimal"
                            value={item.secondary_quantity_received ?? ''}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                'secondary_quantity_received' as keyof CreateGrnItemData,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder={item.secondary_uom || 'pcs'}
                            title={`Pieces (${item.secondary_uom || 'pcs'})`}
                            className="w-24 h-7 text-xs"
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            'unit_price',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24"
                        disabled={!!item.po_item_id}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Select
                          value={item.discount_type ?? 'none'}
                          onValueChange={(v) => handleItemChange(index, 'discount_type', v === 'none' ? null : v)}
                        >
                          <SelectTrigger className="w-[70px] h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            <SelectItem value="percent">%</SelectItem>
                            <SelectItem value="fixed">Rs</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number" min="0"
                          value={item.discount_value ?? 0}
                          disabled={!item.discount_type}
                          onChange={(e) => handleItemChange(index, 'discount_value', parseFloat(e.target.value) || 0)}
                          className="w-20"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{item.total_cost.toFixed(2)}</TableCell>
                    <TableCell>
                      <Select
                        value={item.quality_status}
                        onValueChange={(value) =>
                          handleItemChange(index, 'quality_status', value)
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="damaged">Damaged</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {item.is_batch_tracked ? (
                        <div className="flex items-center gap-1">
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              value={item.batch_number || ''}
                              onChange={(e) => handleItemChange(index, 'batch_number', e.target.value)}
                              placeholder="Batch #*"
                              className={cn("w-28 h-8 text-xs", item.is_batch_tracked && !item.batch_number?.trim() && "border-destructive")}
                            />
                            <Input
                              type="date"
                              value={item.manufacturing_date || ''}
                              onChange={(e) => handleItemChange(index, 'manufacturing_date', e.target.value)}
                              className="w-32 h-8 text-xs"
                              title="Mfg Date"
                            />
                            <Input
                              type="date"
                              value={item.expiry_date || ''}
                              onChange={(e) => handleItemChange(index, 'expiry_date', e.target.value)}
                              className="w-32 h-8 text-xs"
                              title="Expiry Date"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            title="Auto-generate batch number"
                            onClick={() => fillBatchNumber(index)}
                          >
                            Gen
                          </Button>
                        </div>
                      ) : item.is_serialized ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full h-8">
                              <span className="text-xs">{item.serial_numbers?.length ? `${item.serial_numbers.length} SN` : 'Enter SNs'}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80" align="start">
                            <div className="space-y-2">
                              <Label className="text-xs">Serial Numbers (one per line)</Label>
                              <Textarea
                                value={item.serial_numbers?.join('\n') || ''}
                                onChange={(e) => {
                                  const serials = e.target.value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                                  handleItemChange(index, 'serial_numbers', serials);
                                }}
                                placeholder="Enter serial numbers, one per line"
                                rows={4}
                              />
                              <p className="text-xs text-muted-foreground">
                                {item.serial_numbers?.length || 0} serial(s) entered
                                {item.quantity_received > 0 && item.serial_numbers?.length !== item.quantity_received && (
                                  <span className="text-amber-600 ml-2">(should match qty: {item.quantity_received})</span>
                                )}
                              </p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getItemStatus(item).variant}>
                        {getItemStatus(item).label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <Label>Remarks</Label>
            <Textarea {...form.register('remarks')} />
          </div>

          {/* Totals & overall discount */}
          {items.length > 0 && (() => {
            const subtotal = items.reduce((s, it) => s + (Number(it.quantity_received) || 0) * (Number(it.unit_price) || 0), 0);
            const afterLine = items.reduce((s, it) => s + grnLineNet(it), 0);
            const lineDiscTotal = subtotal - afterLine;
            const dv = Number(overallDiscValue) || 0;
            const docDisc = Math.min(
              Math.max(overallDiscType === 'percent' ? (afterLine * dv) / 100 : overallDiscType === 'fixed' ? dv : 0, 0),
              afterLine,
            );
            const netTotal = afterLine - docDisc;
            const tv = Number(taxValue) || 0;
            const taxAmt = Math.max(0, taxType === 'percent' ? (netTotal * tv) / 100 : taxType === 'fixed' ? tv : 0);
            const grandTotal = netTotal + taxAmt;
            const fmt = (n: number) => `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            return (
              <div className="ml-auto w-full max-w-sm rounded-lg border p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(subtotal)}</span></div>
                {lineDiscTotal > 0 && (
                  <div className="flex justify-between text-muted-foreground"><span>Line discounts</span><span>−{fmt(lineDiscTotal)}</span></div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Overall discount</span>
                  <div className="flex items-center gap-1">
                    <Select value={overallDiscType} onValueChange={(v) => setOverallDiscType(v as any)}>
                      <SelectTrigger className="w-[72px] h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="fixed">Rs</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" min="0" className="w-24 h-9" value={overallDiscValue}
                      disabled={overallDiscType === 'none'}
                      onChange={(e) => setOverallDiscValue(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                {docDisc > 0 && (
                  <div className="flex justify-between text-muted-foreground"><span>Overall discount applied</span><span>−{fmt(docDisc)}</span></div>
                )}
                <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Net (goods)</span><span>{fmt(netTotal)}</span></div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Tax</span>
                  <div className="flex items-center gap-1">
                    <Select value={taxType} onValueChange={(v) => setTaxType(v as any)}>
                      <SelectTrigger className="w-[72px] h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="fixed">Rs</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" min="0" className="w-24 h-9" value={taxValue}
                      disabled={taxType === 'none'}
                      onChange={(e) => setTaxValue(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                {taxAmt > 0 && (
                  <div className="flex justify-between text-muted-foreground"><span>Tax applied</span><span>+{fmt(taxAmt)}</span></div>
                )}
                <div className="flex justify-between font-semibold border-t pt-2 text-base"><span>Grand total (payable)</span><span>{fmt(grandTotal)}</span></div>
              </div>
            );
          })()}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0 bg-background">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSubmit('draft')}
            disabled={createGrn.isPending || updateDraftGrn.isPending}
          >
            {(createGrn.isPending || updateDraftGrn.isPending)
              ? 'Saving…'
              : isEditMode ? 'Save Changes' : 'Save as Draft'}
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit('submitted')}
            disabled={createGrn.isPending || updateDraftGrn.isPending}
          >
            {(createGrn.isPending || updateDraftGrn.isPending)
              ? 'Submitting…'
              : 'Submit for Approval'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
