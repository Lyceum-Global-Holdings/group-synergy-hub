import { useState } from "react";
import { Cog, Wrench, HardHat, Construction, Package, ShieldCheck } from "lucide-react";
import { useInventoryMaster, useDeleteInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import { InventoryMasterDialog } from "@/components/construction/dialogs/InventoryMasterDialog";
import { ImportInventoryMasterDialog } from "@/components/construction/dialogs/ImportInventoryMasterDialog";
import { DeleteConfirmDialog } from "@/components/construction/dialogs";
import { ItemMasterTable } from "./ItemMasterTable";
import type { InventoryMaster } from "@/types/construction";

// 6 Master sheet tabs
const MASTER_TABS = [
  { value: "machines", label: "Machine Master", icon: Cog, category: "machines" },
  { value: "tools", label: "Tool Master", icon: Wrench, category: "tools" },
  { value: "equipments", label: "Equipment Master", icon: HardHat, category: "equipments" },
  { value: "scaffolding", label: "Scaffolding Master", icon: Construction, category: "scaffolding" },
  { value: "materials", label: "Material Master", icon: Package, category: "materials" },
  { value: "safety", label: "Safety Master", icon: ShieldCheck, category: "safety" },
];

export function ItemMasterSubTabs() {
  const [activeMasterTab, setActiveMasterTab] = useState("machines");
  const [masterDialogOpen, setMasterDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<InventoryMaster | null>(null);
  const [deletingMaster, setDeletingMaster] = useState<InventoryMaster | null>(null);
  const [presetCategory, setPresetCategory] = useState<string | null>(null);

  const { data: inventoryMaster, isLoading: masterLoading } = useInventoryMaster();
  const deleteInventoryMutation = useDeleteInventoryMaster();

  const activeTabConfig = MASTER_TABS.find((tab) => tab.value === activeMasterTab);

  // Filter items by the active category
  const filteredByCategory = inventoryMaster?.filter(
    (item) => item.category === activeTabConfig?.category
  );

  const handleAddItem = () => {
    setEditingMaster(null);
    setPresetCategory(activeTabConfig?.category || null);
    setMasterDialogOpen(true);
  };

  const handleEditItem = (item: InventoryMaster) => {
    setEditingMaster(item);
    setPresetCategory(null);
    setMasterDialogOpen(true);
  };

  const handleDeleteMaster = async () => {
    if (deletingMaster) {
      await deleteInventoryMutation.mutateAsync(deletingMaster.id);
      setDeletingMaster(null);
    }
  };

  const getCategoryLabel = () => {
    return activeTabConfig?.label.replace(" Master", "") || "Item";
  };

  return (
    <div className="space-y-4">
      {/* Master Sub-Tabs */}
      <div className="border-b">
        <div className="flex flex-wrap gap-1">
          {MASTER_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveMasterTab(tab.value)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeMasterTab === tab.value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Content */}
      <ItemMasterTable
        items={filteredByCategory}
        isLoading={masterLoading}
        categoryLabel={getCategoryLabel()}
        onAddItem={handleAddItem}
        onEditItem={handleEditItem}
        onDeleteItem={setDeletingMaster}
        onImport={() => setImportDialogOpen(true)}
      />

      <InventoryMasterDialog
        open={masterDialogOpen}
        onOpenChange={setMasterDialogOpen}
        item={editingMaster}
        presetCategory={presetCategory}
      />

      <ImportInventoryMasterDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      <DeleteConfirmDialog
        open={!!deletingMaster}
        onOpenChange={(open) => !open && setDeletingMaster(null)}
        onConfirm={handleDeleteMaster}
        title="Delete Inventory Item"
        description={`Are you sure you want to delete "${deletingMaster?.item_name}"? This action cannot be undone.`}
        isDeleting={deleteInventoryMutation.isPending}
      />
    </div>
  );
}
