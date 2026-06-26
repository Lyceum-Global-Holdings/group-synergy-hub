import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { useRentalCategories } from "@/hooks/useRentalCategories";
import type { RentalCategory } from "@/types/costumeRental";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
}

export function RentalCategoriesDialog({ open, onOpenChange, companyId }: Props) {
  const { categories, createCategory, deleteCategory, isCreating } = useRentalCategories(companyId);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState<string>("none");

  const nameById = (id: string | null) =>
    id ? categories.find((c: RentalCategory) => c.id === id)?.name ?? "—" : null;

  const handleAdd = async () => {
    if (!name.trim() || !companyId) return;
    await createCategory.mutateAsync({
      name: name.trim(),
      code: code.trim() || null,
      parent_id: parentId === "none" ? null : parentId,
      company_id: companyId,
    });
    setName("");
    setCode("");
    setParentId("none");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Costume Categories</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add form */}
          <div className="grid grid-cols-1 gap-3 rounded-lg border p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Medieval" />
              </div>
              <div className="space-y-1">
                <Label>Code (optional)</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MED" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Parent (optional)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue placeholder="Top level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Top level</SelectItem>
                  {categories.map((c: RentalCategory) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={!name.trim() || isCreating} className="w-fit">
              <Plus className="h-4 w-4 mr-2" />
              Add category
            </Button>
          </div>

          {/* List */}
          <div className="space-y-1">
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No categories yet.</p>
            )}
            {categories.map((c: RentalCategory) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{c.name}</span>
                  {c.code && <span className="ml-2 text-xs text-muted-foreground">{c.code}</span>}
                  {c.parent_id && (
                    <span className="ml-2 text-xs text-muted-foreground">↳ {nameById(c.parent_id)}</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => deleteCategory.mutate(c.id)}
                  title="Delete category"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
