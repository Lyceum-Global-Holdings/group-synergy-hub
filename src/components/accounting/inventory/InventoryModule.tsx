import { PlaceholderContent } from "../PlaceholderContent";

interface InventoryModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function InventoryModule({ activeSubTab, onSubTabChange }: InventoryModuleProps) {
  return (
    <PlaceholderContent
      title="Inventory Module"
      description="Stock levels, batch tracking, inventory ageing, and stock reconciliation will be available here. This module is currently under development."
    />
  );
}