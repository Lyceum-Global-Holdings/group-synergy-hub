import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useCostumes, uploadCostumeImage } from "@/hooks/useCostumes";
import { useRentalCategories } from "@/hooks/useRentalCategories";
import type { Costume, RentalCategory, CostumeStatus } from "@/types/costumeRental";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  costume?: Costume | null;
}

const EMPTY = {
  name: "", description: "", category_id: "none",
  size: "", color: "", gender: "", theme: "", brand: "",
  daily_rate: "0", flat_rate: "", security_deposit: "0", replacement_value: "0",
  status: "active",
};

export function CreateCostumeDialog({ open, onOpenChange, companyId, costume }: Props) {
  const { categories } = useRentalCategories(companyId);
  const { createCostume, updateCostume } = useCostumes(companyId);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (costume) {
        setForm({
          name: costume.name, description: costume.description ?? "",
          category_id: costume.category_id ?? "none",
          size: costume.size ?? "", color: costume.color ?? "", gender: costume.gender ?? "",
          theme: costume.theme ?? "", brand: costume.brand ?? "",
          daily_rate: String(costume.daily_rate ?? 0),
          flat_rate: costume.flat_rate != null ? String(costume.flat_rate) : "",
          security_deposit: String(costume.security_deposit ?? 0),
          replacement_value: String(costume.replacement_value ?? 0),
          status: costume.status,
        });
        setImageUrl(costume.image_url ?? null);
      } else {
        setForm(EMPTY);
        setImageUrl(null);
      }
      setImageFile(null);
    }
  }, [open, costume]);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!companyId) { toast.error("Select a company first"); return; }
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFile) finalImageUrl = await uploadCostumeImage(imageFile);

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category_id: form.category_id === "none" ? null : form.category_id,
        size: form.size.trim() || null,
        color: form.color.trim() || null,
        gender: form.gender.trim() || null,
        theme: form.theme.trim() || null,
        brand: form.brand.trim() || null,
        image_url: finalImageUrl,
        daily_rate: Number(form.daily_rate) || 0,
        flat_rate: form.flat_rate === "" ? null : Number(form.flat_rate),
        security_deposit: Number(form.security_deposit) || 0,
        replacement_value: Number(form.replacement_value) || 0,
        status: form.status as CostumeStatus,
        company_id: companyId,
      };

      if (costume) await updateCostume.mutateAsync({ id: costume.id, ...payload });
      else await createCostume.mutateAsync(payload);
      onOpenChange(false);
    } catch {
      /* toast handled in hook / upload */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{costume ? "Edit Costume" : "New Costume"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Victorian Gown" />
          </div>

          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
              <SelectTrigger><SelectValue placeholder="Uncategorised" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorised</SelectItem>
                {categories.map((c: RentalCategory) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1"><Label>Size</Label>
            <Input value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="M / L / 38" /></div>
          <div className="space-y-1"><Label>Color</Label>
            <Input value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="Red" /></div>
          <div className="space-y-1"><Label>Gender</Label>
            <Input value={form.gender} onChange={(e) => set("gender", e.target.value)} placeholder="Unisex" /></div>
          <div className="space-y-1"><Label>Theme / Era</Label>
            <Input value={form.theme} onChange={(e) => set("theme", e.target.value)} placeholder="Victorian" /></div>
          <div className="space-y-1 col-span-2"><Label>Brand / Designer</Label>
            <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} /></div>

          <div className="space-y-1"><Label>Daily rate (LKR)</Label>
            <Input type="number" min="0" step="0.01" value={form.daily_rate} onChange={(e) => set("daily_rate", e.target.value)} /></div>
          <div className="space-y-1"><Label>Flat rate (optional)</Label>
            <Input type="number" min="0" step="0.01" value={form.flat_rate} onChange={(e) => set("flat_rate", e.target.value)} placeholder="Overrides daily × days" /></div>
          <div className="space-y-1"><Label>Security deposit (LKR)</Label>
            <Input type="number" min="0" step="0.01" value={form.security_deposit} onChange={(e) => set("security_deposit", e.target.value)} /></div>
          <div className="space-y-1"><Label>Replacement value (LKR)</Label>
            <Input type="number" min="0" step="0.01" value={form.replacement_value} onChange={(e) => set("replacement_value", e.target.value)} /></div>

          <div className="col-span-2 space-y-1">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Photo</Label>
            <div className="flex items-center gap-3">
              {imageUrl && <img src={imageUrl} alt="" className="h-16 w-16 rounded object-cover border" />}
              <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" />
                {imageFile ? imageFile.name : "Upload image"}
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setImageFile(f);
                    if (f) setImageUrl(URL.createObjectURL(f));
                  }} />
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : costume ? "Save changes" : "Create costume"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
