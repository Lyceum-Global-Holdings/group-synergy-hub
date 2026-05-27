import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { useAssetMaster } from "@/hooks/useAssetMaster";
import { useAssetCategories } from "@/hooks/useAssetCategories";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { AssetMasterSelector } from "@/components/common/AssetMasterSelector";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface CreateAssetRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RequestItem {
  id?: string;
  request_type: "from_master" | "new_item";
  asset_master_id?: string;
  item_name?: string;
  item_description?: string;
  brand?: string;
  specifications?: string;
  category_id?: string;
  subcategory_id?: string;
  quantity_requested: number;
  justification?: string;
  preferred_vendor?: string;
}

export const CreateAssetRequestDialog = ({ open, onOpenChange }: CreateAssetRequestDialogProps) => {
  const { toast } = useToast();
  const { createRequest, isCreating } = useAssetRequests();
  const { assetMasterItems } = useAssetMaster();
  const { mainCategories, getSubcategories } = useAssetCategories();

  const [requesterName, setRequesterName] = useState("");
  const [department, setDepartment] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [purpose, setPurpose] = useState("");
  const [justification, setJustification] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [mrnFile, setMrnFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<RequestItem[]>([{
    request_type: "from_master",
    quantity_requested: 1
  }]);

  const handleAddItem = () => {
    setItems(prev => [...prev, { request_type: "from_master", quantity_requested: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Functional updater — patches multiple fields atomically to avoid stale-closure overwrites.
  const handleItemPatch = (index: number, patch: Partial<RequestItem>) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    if (!requesterName || !purpose || !requiredDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const hasInvalidItems = items.some(item => {
      const hasValidQuantity = item.quantity_requested > 0;
      if (!item.category_id) return true;
      if (item.request_type === "from_master") {
        return !item.asset_master_id || !hasValidQuantity;
      }
      return !item.item_name || !hasValidQuantity;
    });

    if (items.length === 0 || hasInvalidItems) {
      toast({
        title: "Validation Error",
        description: "Each item needs a category, an asset/name, and a quantity",
        variant: "destructive"
      });
      return;
    }

    let mrnUrl: string | null = null;
    let mrnPath: string | null = null;
    if (mrnFile) {
      try {
        setUploading(true);
        const safeName = mrnFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `mrn/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("asset-request-documents")
          .upload(path, mrnFile, { upsert: false, contentType: mrnFile.type });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("asset-request-documents")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        mrnPath = path;
        mrnUrl = signed?.signedUrl ?? null;
      } catch (e: any) {
        setUploading(false);
        toast({ title: "MRN upload failed", description: e.message, variant: "destructive" });
        return;
      }
      setUploading(false);
    }

    const request = {
      requester_name: requesterName,
      department,
      contact_number: contactNumber,
      required_date: requiredDate,
      priority,
      purpose,
      justification,
      approved_by_name: approvedBy || null,
      mrn_document_url: mrnUrl,
      mrn_document_path: mrnPath,
      status: asDraft ? "draft" as const : "pending_hod_approval" as const,
      request_date: new Date().toISOString().split('T')[0]
    };

    const itemsWithLineNumbers = items.map((item, index) => {
      const lineItem: any = { ...item, line_number: index + 1 };
      if (item.request_type === "from_master" && item.asset_master_id) {
        const am = assetMasterItems.find(a => a.id === item.asset_master_id);
        if (am) {
          if (!lineItem.item_name) lineItem.item_name = am.asset_name;
          if (!lineItem.brand) lineItem.brand = am.brand || undefined;
          if (!lineItem.category_id) lineItem.category_id = am.category_id || undefined;
          if (!lineItem.subcategory_id) lineItem.subcategory_id = am.subcategory_id || undefined;
        }
      }
      // Normalize empty strings to null for uuid fields
      if (!lineItem.category_id) lineItem.category_id = null;
      if (!lineItem.subcategory_id) lineItem.subcategory_id = null;
      return lineItem;
    });

    createRequest(
      { request, items: itemsWithLineNumbers },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: asDraft ? "Request saved as draft" : "Request submitted for approval"
          });
          onOpenChange(false);
          setRequesterName("");
          setDepartment("");
          setContactNumber("");
          setRequiredDate("");
          setPriority("medium");
          setPurpose("");
          setJustification("");
          setApprovedBy("");
          setMrnFile(null);
          setItems([{ request_type: "from_master", quantity_requested: 1 }]);
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Asset Request</DialogTitle>
          <DialogDescription className="sr-only">
            Fill in request details and add assets to create a new asset request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Request Header */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requesterName">Requester Name *</Label>
                  <Input
                    id="requesterName"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="Enter requester name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Enter department"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number</Label>
                  <Input
                    id="contactNumber"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="Enter contact number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requiredDate">Required Date *</Label>
                  <Input
                    id="requiredDate"
                    type="date"
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
                  <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
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

                <div className="space-y-2">
                  <Label htmlFor="approvedBy">Approved By</Label>
                  <Input
                    id="approvedBy"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    placeholder="Name of approver"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose *</Label>
                <Textarea
                  id="purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Enter purpose of request"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="justification">Justification</Label>
                <Textarea
                  id="justification"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Enter justification for request"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mrnFile">MRN Copy</Label>
                {mrnFile ? (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="truncate">{mrnFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMrnFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="mrnFile"
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50"
                  >
                    <Upload className="h-4 w-4" />
                    Upload MRN copy (PDF or image)
                  </label>
                )}
                <Input
                  id="mrnFile"
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => setMrnFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Request Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Request Items *</Label>
              <Button onClick={handleAddItem} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead className="min-w-[220px]">Asset/Item *</TableHead>
                    <TableHead className="min-w-[160px]">Category *</TableHead>
                    <TableHead className="min-w-[160px]">Sub-category</TableHead>
                    <TableHead className="w-[100px]">Quantity</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const subOptions = item.category_id ? getSubcategories(item.category_id) : [];
                    const lockedFromMaster = item.request_type === "from_master" && !!item.asset_master_id;
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={item.request_type}
                            onValueChange={(value: any) =>
                              handleItemPatch(index, {
                                request_type: value,
                                asset_master_id: undefined,
                                item_name: undefined,
                                brand: undefined,
                                category_id: undefined,
                                subcategory_id: undefined,
                              })
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="from_master">From Master</SelectItem>
                              <SelectItem value="new_item">New Item</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {item.request_type === "from_master" ? (
                            <AssetMasterSelector
                              value={item.asset_master_id}
                              onValueChange={(assetMasterId) => {
                                if (!assetMasterId) {
                                  handleItemPatch(index, {
                                    asset_master_id: undefined,
                                    item_name: undefined,
                                    brand: undefined,
                                    category_id: undefined,
                                    subcategory_id: undefined,
                                  });
                                }
                              }}
                              onAssetSelected={(assetMaster) => {
                                if (assetMaster) {
                                  handleItemPatch(index, {
                                    asset_master_id: assetMaster.id,
                                    item_name: assetMaster.asset_name,
                                    brand: assetMaster.brand || undefined,
                                    category_id: assetMaster.category_id || undefined,
                                    subcategory_id: assetMaster.subcategory_id || undefined,
                                  });
                                }
                              }}
                            />
                          ) : (
                            <Input
                              placeholder="Enter item name"
                              value={item.item_name || ""}
                              onChange={(e) => handleItemPatch(index, { item_name: e.target.value })}
                              className="h-8"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.category_id || ""}
                            onValueChange={(value) =>
                              handleItemPatch(index, {
                                category_id: value || undefined,
                                subcategory_id: undefined,
                              })
                            }
                            disabled={lockedFromMaster}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {mainCategories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.subcategory_id || ""}
                            onValueChange={(value) =>
                              handleItemPatch(index, { subcategory_id: value || undefined })
                            }
                            disabled={lockedFromMaster || !item.category_id || subOptions.length === 0}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue
                                placeholder={
                                  !item.category_id
                                    ? "Pick category first"
                                    : subOptions.length === 0
                                    ? "No sub-categories"
                                    : "Select sub-category"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {subOptions.map((sc) => (
                                <SelectItem key={sc.id} value={sc.id}>
                                  {sc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity_requested}
                            onChange={(e) =>
                              handleItemPatch(index, {
                                quantity_requested: parseInt(e.target.value) || 1,
                              })
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                            disabled={items.length === 1}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={isCreating || uploading}>
              Save as Draft
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={isCreating || uploading}>
              {uploading ? "Uploading…" : "Submit for Approval"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
